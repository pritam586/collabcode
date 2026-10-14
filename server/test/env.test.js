import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config/env.js';

test('uses safe defaults when nothing is configured', () => {
  const config = loadConfig({});
  assert.equal(config.port, 4000);
  assert.equal(config.env, 'development');
  assert.equal(config.runner.enabled, true);
  assert.equal(config.rooms.maxParticipants, 10);
  assert.equal(config.rooms.emptyRoomTtlMs, 30 * 60 * 1000);
  assert.equal(config.trustProxy, false);
});

test('treats blank values as unset', () => {
  assert.equal(loadConfig({ PORT: '', MAX_PARTICIPANTS_PER_ROOM: '' }).port, 4000);
});

test('only the literal "false" disables the code runner', () => {
  assert.equal(loadConfig({ CODE_RUNNER_ENABLED: 'false' }).runner.enabled, false);
  assert.equal(loadConfig({ CODE_RUNNER_ENABLED: 'FALSE' }).runner.enabled, false);
  assert.equal(loadConfig({ CODE_RUNNER_ENABLED: 'yes' }).runner.enabled, true);
});

test('parses trust proxy values like Express does', () => {
  assert.equal(loadConfig({ TRUST_PROXY: 'true' }).trustProxy, true);
  assert.equal(loadConfig({ TRUST_PROXY: '1' }).trustProxy, 1);
  assert.equal(loadConfig({ TRUST_PROXY: 'loopback' }).trustProxy, 'loopback');
});

test('rejects invalid values with a readable message', () => {
  assert.throws(() => loadConfig({ PORT: '70000' }), /Invalid server configuration[\s\S]*PORT/);
  assert.throws(() => loadConfig({ NODE_ENV: 'staging' }), /NODE_ENV/);
});
