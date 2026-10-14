import assert from 'node:assert/strict';
import test from 'node:test';
import { openDatabase, runMigrations } from '../src/db/database.js';
import { migrations } from '../src/db/migrations/index.js';
import { createRoomRepository } from '../src/models/roomRepository.js';

const room = (id, overrides = {}) => ({
  id,
  content: `content of ${id}`,
  language: 'python',
  docVersion: 3,
  createdAt: 1000,
  updatedAt: 2000,
  lastActiveAt: 2000,
  ...overrides,
});

test('migrations are recorded and safe to run twice', () => {
  const db = openDatabase(':memory:');
  runMigrations(db, migrations);
  const versions = db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version);
  assert.deepEqual(versions, migrations.map((migration) => migration.version));
  db.close();
});

test('a failing migration is rolled back completely', () => {
  const db = openDatabase(':memory:');
  assert.throws(() => runMigrations(db, [{ version: 99, name: 'broken', up: 'CREATE TABLE half_done (x); SELECT nope FROM missing;' }]));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'half_done'").get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations WHERE version = 99').get().n, 0);
  db.close();
});

test('saves, updates and finds rooms', () => {
  const repository = createRoomRepository(openDatabase(':memory:'));
  assert.equal(repository.find('missing'), null);

  repository.saveMany([room('a'), room('b')]);
  assert.deepEqual(repository.find('a'), room('a'));

  repository.saveMany([room('a', { content: 'changed', docVersion: 4, updatedAt: 3000, lastActiveAt: 3000, createdAt: 9999 })]);
  const updated = repository.find('a');
  assert.equal(updated.content, 'changed');
  assert.equal(updated.docVersion, 4);
  assert.equal(updated.createdAt, 1000, 'created_at is never overwritten');
  assert.equal(repository.count(), 2);
});

test('deletes inactive rooms except the ones still open', () => {
  const repository = createRoomRepository(openDatabase(':memory:'));
  repository.saveMany([room('old', { lastActiveAt: 10 }), room('old-but-open', { lastActiveAt: 10 }), room('recent', { lastActiveAt: 500 })]);

  assert.equal(repository.deleteInactive(100, ['old-but-open']), 1);
  assert.equal(repository.find('old'), null);
  assert.ok(repository.find('old-but-open'));
  assert.ok(repository.find('recent'));
});
