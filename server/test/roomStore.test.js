import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDeltaToString } from '../src/state/roomStore.js';

test('applies a replacement delta across multiple lines', () => {
  const next = applyDeltaToString('one\ntwo\nthree', {
    range: {
      startLineNumber: 1,
      startColumn: 4,
      endLineNumber: 3,
      endColumn: 1,
    },
    text: ' + ',
  });

  assert.equal(next, 'one + three');
});

test('rejects deltas that point outside the document', () => {
  const next = applyDeltaToString('hello', {
    range: {
      startLineNumber: 2,
      startColumn: 1,
      endLineNumber: 2,
      endColumn: 1,
    },
    text: '!',
  });

  assert.equal(next, null);
});
