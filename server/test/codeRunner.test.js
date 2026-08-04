import assert from 'node:assert/strict';
import test from 'node:test';
import { getSupportedRunLanguages } from '../src/services/codeRunner.js';

test('exposes the runtime-supported languages for the shared editor', () => {
  assert.deepEqual(Array.from(getSupportedRunLanguages()).sort(), ['cpp', 'java', 'python', 'typescript']);
});
