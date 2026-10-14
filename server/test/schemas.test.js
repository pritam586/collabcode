import assert from 'node:assert/strict';
import test from 'node:test';
import { cursorUpdateSchema, displayNameSchema, joinRoomSchema, languageChangeSchema, roomIdSchema } from '../src/validation/schemas.js';

test('room ids allow letters, digits, dots, dashes and underscores', () => {
  assert.equal(roomIdSchema.parse('  team.alpha_1-review '), 'team.alpha_1-review');
  for (const bad of ['', '-starts-with-dash', 'has space', 'x'.repeat(65), 'a/b', '<script>']) {
    assert.equal(roomIdSchema.safeParse(bad).success, false, bad);
  }
});

test('display names are trimmed, normalised and free of control or bidi characters', () => {
  assert.equal(displayNameSchema.parse('  Ada Lovelace  '), 'Ada Lovelace');
  assert.equal(displayNameSchema.parse('René'), 'René');
  assert.equal(displayNameSchema.safeParse('Eve‮nimda').success, false);
  assert.equal(displayNameSchema.safeParse('tab\there').success, false);
  assert.equal(displayNameSchema.safeParse('x'.repeat(33)).success, false);
});

test('join payloads drop unknown fields', () => {
  assert.deepEqual(joinRoomSchema.parse({ roomId: 'r1', name: 'Ada', isAdmin: true }), { roomId: 'r1', name: 'Ada' });
});

test('cursor selections must be ordered and use positive integers', () => {
  const position = { startLineNumber: 2, startColumn: 1, endLineNumber: 1, endColumn: 1 };
  assert.equal(cursorUpdateSchema.safeParse({ roomId: 'r1', position }).success, false);
  assert.equal(cursorUpdateSchema.safeParse({ roomId: 'r1', position: { ...position, startLineNumber: 1, startColumn: 0 } }).success, false);
  assert.equal(cursorUpdateSchema.safeParse({ roomId: 'r1', position: { ...position, startLineNumber: 1 } }).success, true);
});

test('language changes accept only editor languages', () => {
  assert.equal(languageChangeSchema.safeParse({ roomId: 'r1', language: 'python' }).success, true);
  assert.equal(languageChangeSchema.safeParse({ roomId: 'r1', language: 'cobol' }).success, false);
});
