import assert from 'node:assert/strict';
import test from 'node:test';
import { createOriginMatcher } from '../src/config/origins.js';

test('accepts every origin in a comma-separated CLIENT_ORIGIN list', () => {
  const isAllowed = createOriginMatcher({
    clientOrigin: 'https://app.example.com, https://staging.example.com/',
    nodeEnv: 'production',
  });
  assert.equal(isAllowed('https://app.example.com'), true);
  assert.equal(isAllowed('https://staging.example.com'), true);
  assert.equal(isAllowed('https://evil.example.com'), false);
});

test('accepts any local dev port outside production', () => {
  const isAllowed = createOriginMatcher({ nodeEnv: 'development' });
  assert.equal(isAllowed('http://localhost:5174'), true);
  assert.equal(isAllowed('http://127.0.0.1:3000'), true);
  assert.equal(isAllowed('http://localhost.evil.com:5173'), false);
});

test('rejects local dev ports in production unless listed', () => {
  const isAllowed = createOriginMatcher({ clientOrigin: 'http://localhost:5173', nodeEnv: 'production' });
  assert.equal(isAllowed('http://localhost:5173'), true);
  assert.equal(isAllowed('http://localhost:5174'), false);
  assert.equal(isAllowed(undefined), false);
});
