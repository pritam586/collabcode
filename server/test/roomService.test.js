import assert from 'node:assert/strict';
import test from 'node:test';
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { openDatabase } from '../src/db/database.js';
import { createRoomRepository } from '../src/models/roomRepository.js';
import { createRoomService } from '../src/services/roomService.js';
import { silentLogger } from './helpers.js';

const MINUTE = 60 * 1000;

function setup(options = {}) {
  const clock = { now: 1_000_000 };
  const repository = options.repository ?? createRoomRepository(openDatabase(':memory:'));
  const services = [];
  const create = () => {
    const service = createRoomService({ repository, logger: silentLogger, now: () => clock.now, ...options });
    services.push(service);
    return service;
  };
  return {
    clock,
    repository,
    service: create(),
    create,
    closeAll: () => services.forEach((service) => service.close()),
  };
}

// A Yjs update that inserts `text` at `index` on top of `room`'s current document.
function editOf(room, index, text) {
  const clientDoc = new Y.Doc();
  Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(room.doc));
  const before = Y.encodeStateVector(clientDoc);
  clientDoc.getText('content').insert(index, text);
  const update = Y.encodeStateAsUpdate(clientDoc, before);
  clientDoc.destroy();
  return update;
}

test('assigns distinct colors and refuses joins beyond the room limit', (t) => {
  const { service, closeAll } = setup({ maxParticipants: 2 });
  t.after(closeAll);
  const first = service.join('room', 's1', 'Ada');
  const second = service.join('room', 's2', 'Grace');
  assert.ok(first.ok && second.ok);
  assert.notEqual(first.participant.color, second.participant.color);

  assert.deepEqual(service.join('room', 's3', 'Linus'), { ok: false, reason: 'full', maxParticipants: 2 });
  assert.equal(service.join('room', 's1', 'Ada again').ok, true, 'an existing participant can rejoin');

  service.leave('room', 's2');
  assert.equal(service.join('room', 's3', 'Linus').ok, true);
});

test('applies Yjs updates and reports them with their origin', (t) => {
  const { service, closeAll } = setup();
  t.after(closeAll);
  const { room } = service.join('room', 's1', 'Ada');
  const seen = [];
  service.on('document-update', (_room, _update, origin) => seen.push(origin));

  assert.equal(service.applyUpdate('room', editOf(room, 0, 'hello'), 's1').status, 'accepted');
  assert.equal(room.text.toString(), 'hello');
  assert.equal(room.docVersion, 1);
  assert.deepEqual(seen, ['s1']);
});

test('merges concurrent edits from two clients', (t) => {
  const { service, closeAll } = setup();
  t.after(closeAll);
  const { room } = service.join('room', 's1', 'Ada');
  service.applyUpdate('room', editOf(room, 0, 'ac'), 's1');

  // Both clients start from "ac" and edit without seeing each other's change.
  const fromAda = editOf(room, 1, 'b');
  const fromGrace = editOf(room, 2, 'd');
  service.applyUpdate('room', fromGrace, 's2');
  service.applyUpdate('room', fromAda, 's1');
  assert.equal(room.text.toString(), 'abcd');
});

test('rejects malformed updates and edits beyond the document limit', (t) => {
  const { service, closeAll } = setup();
  t.after(closeAll);
  const { room } = service.join('room', 's1', 'Ada');

  assert.equal(service.applyUpdate('room', new Uint8Array([1, 2, 3, 4, 5]), 's1').status, 'invalid');
  assert.equal(service.applyUpdate('room', editOf(room, 0, 'x'.repeat(100_001)), 's1').status, 'too-large');
  assert.equal(room.text.length, 0);
  assert.equal(service.applyUpdate('room', editOf(room, 0, 'x'.repeat(100_000)), 's1').status, 'accepted');
  assert.equal(service.applyUpdate('unknown-room', editOf(room, 0, 'y'), 's1').status, 'invalid');
});

test('restores the document, language and change count from the database after a restart', (t) => {
  const { service, create, closeAll } = setup();
  t.after(closeAll);
  const { room } = service.join('room', 's1', 'Ada');
  service.applyUpdate('room', editOf(room, 0, 'hello'), 's1');
  service.setLanguage('room', 'python');
  service.close();

  const restarted = create();
  const reopened = restarted.join('room', 's9', 'Ada').room;
  assert.equal(reopened.text.toString(), 'hello');
  assert.equal(reopened.language, 'python');
  assert.equal(reopened.docVersion, 1);
  assert.equal(reopened.participants.size, 1, 'participants are never persisted');
});

test('converts rooms saved before Yjs from their plain-text content', (t) => {
  const repository = createRoomRepository(openDatabase(':memory:'));
  repository.saveMany([
    {
      id: 'legacy',
      content: 'print(1)',
      ydoc: null,
      language: 'python',
      docVersion: 7,
      createdAt: 1,
      updatedAt: 1,
      lastActiveAt: 1,
    },
  ]);
  const { service, closeAll } = setup({ repository });
  t.after(closeAll);

  const { room } = service.join('legacy', 's1', 'Ada');
  assert.equal(room.text.toString(), 'print(1)');
  service.flush();
  assert.ok(repository.find('legacy').ydoc, 'the converted document is saved');
});

test('saves immediately when the last participant leaves', (t) => {
  const { service, repository, closeAll } = setup();
  t.after(closeAll);
  const { room } = service.join('room', 's1', 'Ada');
  service.applyUpdate('room', editOf(room, 0, 'hello'), 's1');
  assert.equal(repository.find('room'), null, 'edits are batched until the next flush');

  service.leave('room', 's1');
  assert.equal(repository.find('room').content, 'hello');
});

test('never stores rooms that were only visited', (t) => {
  const { service, repository, closeAll } = setup();
  t.after(closeAll);
  service.join('room', 's1', 'Ada');
  service.leave('room', 's1');
  service.flush();
  assert.equal(repository.count(), 0);
});

test('evicts empty rooms from memory after the TTL but keeps them in the database', (t) => {
  const { service, clock, repository, closeAll } = setup({ emptyRoomTtlMs: 30 * MINUTE });
  t.after(closeAll);
  const { room } = service.join('room', 's1', 'Ada');
  service.applyUpdate('room', editOf(room, 0, 'hello'), 's1');
  service.leave('room', 's1');

  clock.now += 29 * MINUTE;
  service.sweep();
  assert.ok(service.getRoom('room'));

  clock.now += 2 * MINUTE;
  service.sweep();
  assert.equal(service.getRoom('room'), undefined);
  assert.equal(repository.find('room').content, 'hello');
  assert.equal(service.join('room', 's2', 'Grace').room.text.toString(), 'hello');
});

test('deletes stored rooms nobody has opened within the retention period', (t) => {
  const { service, clock, repository, closeAll } = setup({ emptyRoomTtlMs: MINUTE, retentionMs: 10 * MINUTE });
  t.after(closeAll);
  const old = service.join('old', 's1', 'Ada').room;
  service.applyUpdate('old', editOf(old, 0, 'hello'), 's1');
  service.leave('old', 's1');
  const open = service.join('open', 's2', 'Grace').room;
  service.applyUpdate('open', editOf(open, 0, 'hello'), 's2');
  service.flush();

  clock.now += 11 * MINUTE;
  service.sweep();
  assert.equal(repository.find('old'), null);
  assert.ok(repository.find('open'), 'rooms with people in them are kept');
});

test('keeps rooms dirty and retries when saving fails', (t) => {
  let failures = 1;
  const real = createRoomRepository(openDatabase(':memory:'));
  const flaky = {
    ...real,
    saveMany(rooms) {
      if (failures-- > 0) throw new Error('disk full');
      real.saveMany(rooms);
    },
  };
  const { service, closeAll } = setup({ repository: flaky });
  t.after(closeAll);
  const { room } = service.join('room', 's1', 'Ada');
  service.applyUpdate('room', editOf(room, 0, 'hello'), 's1');

  service.flush();
  assert.equal(service.stats().unsavedRooms, 1);
  service.flush();
  assert.equal(service.stats().unsavedRooms, 0);
  assert.equal(real.find('room').content, 'hello');
});

test('binds awareness states to the sender and removes them when the sender leaves', (t) => {
  const { service, closeAll } = setup();
  t.after(closeAll);
  const { room } = service.join('room', 's1', 'Ada');
  service.join('room', 's2', 'Grace');

  const adaAwareness = new Awareness(new Y.Doc());
  adaAwareness.setLocalState({ user: { name: 'Mallory', color: 'rose' }, typing: true, secret: 'x' });
  const adaUpdate = encodeAwarenessUpdate(adaAwareness, [adaAwareness.clientID]);
  assert.equal(service.applyAwareness('room', 's1', adaUpdate), true);

  const state = room.awareness.getStates().get(adaAwareness.clientID);
  assert.deepEqual(state, {
    typing: true,
    user: { socketId: 's1', name: 'Ada', color: room.participants.get('s1').color },
  });

  assert.equal(service.applyAwareness('room', 's2', adaUpdate), false, "Grace cannot overwrite Ada's state");
  assert.equal(service.applyAwareness('room', 'outsider', adaUpdate), false);

  service.leave('room', 's1');
  assert.equal(room.awareness.getStates().has(adaAwareness.clientID), false);
  adaAwareness.destroy();
});

test('keeps carriage returns out of the shared text so editor offsets always match', (t) => {
  const repository = createRoomRepository(openDatabase(':memory:'));
  const legacyDoc = new Y.Doc();
  legacyDoc.getText('content').insert(0, 'a\r\nb\rc');
  repository.saveMany([
    {
      id: 'legacy-text',
      content: 'one\r\ntwo',
      ydoc: null,
      language: 'python',
      docVersion: 1,
      createdAt: 1,
      updatedAt: 1,
      lastActiveAt: 1,
    },
    {
      id: 'legacy-ydoc',
      content: '',
      ydoc: Y.encodeStateAsUpdate(legacyDoc),
      language: 'python',
      docVersion: 1,
      createdAt: 1,
      updatedAt: 1,
      lastActiveAt: 1,
    },
  ]);
  const { service, closeAll } = setup({ repository });
  t.after(closeAll);

  assert.equal(service.join('legacy-text', 's1', 'Ada').room.text.toString(), 'one\ntwo');
  assert.equal(service.join('legacy-ydoc', 's1', 'Ada').room.text.toString(), 'a\nb\nc');

  const { room } = service.join('fresh', 's2', 'Grace');
  assert.equal(service.applyUpdate('fresh', editOf(room, 0, 'line\r\n'), 's2').status, 'invalid');
  assert.equal(room.text.toString(), '');
  assert.equal(service.applyUpdate('fresh', editOf(room, 0, 'line\n'), 's2').status, 'accepted');
});
