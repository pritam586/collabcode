import assert from 'node:assert/strict';
import test from 'node:test';
import { createRateLimiter } from '../src/utils/rateLimiter.js';

test('allows up to the limit per window, then blocks until the window resets', () => {
  const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 2 });
  assert.equal(limiter.allow('a', 0), true);
  assert.equal(limiter.allow('a', 10), true);
  assert.equal(limiter.allow('a', 20), false);
  assert.equal(limiter.allow('b', 20), true);
  assert.equal(limiter.allow('a', 1001), true);
});

test('forgets addresses whose window has expired', () => {
  const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 2 });
  for (let index = 0; index < 50; index += 1) limiter.allow(`client-${index}`, 0);
  assert.equal(limiter.size, 50);

  limiter.allow('late-client', 5000);
  assert.equal(limiter.size, 1);
});
