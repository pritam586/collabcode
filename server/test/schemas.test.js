import assert from 'node:assert/strict';
import test from 'node:test';
import {
  awarenessStateSchema,
  displayNameSchema,
  joinRoomSchema,
  languageChangeSchema,
  roomIdSchema,
  yjsMessageSchema,
} from '../src/validation/schemas.js';

test('room ids allow letters, digits, dots, dashes and underscores', () => {
  assert.equal(roomIdSchema.parse('  team.alpha_1-review '), 'team.alpha_1-review');
  for (const bad of ['', '-starts-with-dash', 'has space', 'x'.repeat(65), 'a/b', '<script>']) {
    assert.equal(roomIdSchema.safeParse(bad).success, false, bad);
  }
});

test('display names are trimmed, normalised and free of control or bidi characters', () => {
  assert.equal(displayNameSchema.parse('  Ada Lovelace  '), 'Ada Lovelace');
  assert.equal(displayNameSchema.parse('René'), 'René');
  assert.equal(displayNameSchema.safeParse(`Eve${String.fromCharCode(0x202e)}nimda`).success, false);
  assert.equal(displayNameSchema.safeParse(`Eve${String.fromCharCode(0x2066)}x`).success, false);
  assert.equal(displayNameSchema.safeParse('tab\there').success, false);
  assert.equal(displayNameSchema.safeParse('x'.repeat(33)).success, false);
});

test('join payloads drop unknown fields', () => {
  assert.deepEqual(joinRoomSchema.parse({ roomId: 'r1', name: 'Ada', isAdmin: true }), { roomId: 'r1', name: 'Ada' });
});

test('Yjs messages must be non-empty binary under the size limit', () => {
  assert.equal(yjsMessageSchema.safeParse({ roomId: 'r1', data: Buffer.from([0, 1]) }).success, true);
  assert.equal(yjsMessageSchema.safeParse({ roomId: 'r1', data: new Uint8Array() }).success, false);
  assert.equal(yjsMessageSchema.safeParse({ roomId: 'r1', data: new Uint8Array(1_000_001) }).success, false);
  assert.equal(yjsMessageSchema.safeParse({ roomId: 'r1', data: 'not binary' }).success, false);
});

test('awareness states keep only the cursor and typing fields', () => {
  const position = { type: { client: 1, clock: 2 }, tname: null, item: null, assoc: 0 };
  const parsed = awarenessStateSchema.parse({
    cursor: { anchor: position, head: position },
    typing: true,
    user: { name: 'Spoofed' },
  });
  assert.deepEqual(parsed, { cursor: { anchor: position, head: position }, typing: true });
  assert.equal(awarenessStateSchema.safeParse({ cursor: { anchor: 'x', head: position } }).success, false);
});

test('language changes accept only editor languages', () => {
  assert.equal(languageChangeSchema.safeParse({ roomId: 'r1', language: 'python' }).success, true);
  assert.equal(languageChangeSchema.safeParse({ roomId: 'r1', language: 'cobol' }).success, false);
});
