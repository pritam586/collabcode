import assert from 'node:assert/strict';
import test from 'node:test';
import { openDatabase } from '../src/db/database.js';
import { createRoomRepository } from '../src/models/roomRepository.js';
import { createRoomService } from '../src/services/roomService.js';
import { silentLogger } from './helpers.js';

const MINUTE = 60 * 1000;
const insertHello = { range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }, text: 'hello' };

function setup(options = {}) {
  const clock = { now: 1_000_000 };
  const repository = options.repository ?? createRoomRepository(openDatabase(':memory:'));
  const create = () => createRoomService({ repository, logger: silentLogger, now: () => clock.now, ...options });
  return { clock, repository, service: create(), create };
}

test('assigns distinct colors and refuses joins beyond the room limit', () => {
  const { service } = setup({ maxParticipants: 2 });
  const first = service.join('room', 's1', 'Ada');
  const second = service.join('room', 's2', 'Grace');
  assert.ok(first.ok && second.ok);
  assert.notEqual(first.participant.color, second.participant.color);

  assert.deepEqual(service.join('room', 's3', 'Linus'), { ok: false, reason: 'full', maxParticipants: 2 });
  assert.equal(service.join('room', 's1', 'Ada again').ok, true, 'an existing participant can rejoin');

  service.leave('room', 's2');
  assert.equal(service.join('room', 's3', 'Linus').ok, true);
});

test('accepts edits at the current version and rejects stale or invalid ones', () => {
  const { service } = setup();
  service.join('room', 's1', 'Ada');

  const accepted = service.applyChange('room', 0, { ...insertHello, extra: 'dropped' });
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.version, 1);
  assert.deepEqual(accepted.delta, insertHello, 'unknown delta fields are not rebroadcast');
  assert.equal(service.getRoom('room').content, 'hello');

  assert.equal(service.applyChange('room', 0, insertHello).status, 'stale');
  assert.equal(service.applyChange('room', 1, { range: insertHello.range, text: 42 }).status, 'invalid');
  assert.equal(service.applyChange('room', 1, { ...insertHello, range: { ...insertHello.range, startLineNumber: 9, endLineNumber: 9 } }).status, 'invalid');
  assert.equal(service.applyChange('unknown-room', 0, insertHello).status, 'invalid');
});

test('restores content, language and version from the database after a restart', () => {
  const { service, create } = setup();
  service.join('room', 's1', 'Ada');
  service.applyChange('room', 0, insertHello);
  service.setLanguage('room', 'python');
  service.close();

  const restarted = create();
  const room = restarted.join('room', 's9', 'Ada').room;
  assert.equal(room.content, 'hello');
  assert.equal(room.language, 'python');
  assert.equal(room.docVersion, 1);
  assert.equal(room.participants.size, 1, 'participants are never persisted');
});

test('saves immediately when the last participant leaves', () => {
  const { service, repository } = setup();
  service.join('room', 's1', 'Ada');
  service.applyChange('room', 0, insertHello);
  assert.equal(repository.find('room'), null, 'edits are batched until the next flush');

  service.leave('room', 's1');
  assert.equal(repository.find('room').content, 'hello');
});

test('never stores rooms that were only visited', () => {
  const { service, repository } = setup();
  service.join('room', 's1', 'Ada');
  service.leave('room', 's1');
  service.flush();
  assert.equal(repository.count(), 0);
});

test('evicts empty rooms from memory after the TTL but keeps them in the database', () => {
  const { service, clock, repository } = setup({ emptyRoomTtlMs: 30 * MINUTE });
  service.join('room', 's1', 'Ada');
  service.applyChange('room', 0, insertHello);
  service.leave('room', 's1');

  clock.now += 29 * MINUTE;
  service.sweep();
  assert.ok(service.getRoom('room'));

  clock.now += 2 * MINUTE;
  service.sweep();
  assert.equal(service.getRoom('room'), undefined);
  assert.equal(repository.find('room').content, 'hello');
  assert.equal(service.join('room', 's2', 'Grace').room.content, 'hello');
});

test('deletes stored rooms nobody has opened within the retention period', () => {
  const { service, clock, repository } = setup({ emptyRoomTtlMs: MINUTE, retentionMs: 10 * MINUTE });
  service.join('old', 's1', 'Ada');
  service.applyChange('old', 0, insertHello);
  service.leave('old', 's1');
  service.join('open', 's2', 'Grace');
  service.applyChange('open', 0, insertHello);
  service.flush();

  clock.now += 11 * MINUTE;
  service.sweep();
  assert.equal(repository.find('old'), null);
  assert.ok(repository.find('open'), 'rooms with people in them are kept');
});

test('keeps rooms dirty and retries when saving fails', () => {
  let failures = 1;
  const real = createRoomRepository(openDatabase(':memory:'));
  const flaky = {
    ...real,
    saveMany(rooms) {
      if (failures-- > 0) throw new Error('disk full');
      real.saveMany(rooms);
    },
  };
  const { service } = setup({ repository: flaky });
  service.join('room', 's1', 'Ada');
  service.applyChange('room', 0, insertHello);

  service.flush();
  assert.equal(service.stats().unsavedRooms, 1);
  service.flush();
  assert.equal(service.stats().unsavedRooms, 0);
  assert.equal(real.find('room').content, 'hello');
});
