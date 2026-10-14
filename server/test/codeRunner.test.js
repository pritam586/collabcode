import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyDockerFailure, CodeRunnerError, getSupportedRunLanguages } from '../src/services/codeRunner.js';

test('exposes the runtime-supported languages for the shared editor', () => {
  assert.deepEqual(Array.from(getSupportedRunLanguages()).sort(), ['cpp', 'java', 'python', 'typescript']);
});

test('reports an unreachable Docker daemon as a service error, not program output', () => {
  const failure = classifyDockerFailure(1, 'failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the daemon is running\n');
  assert.ok(failure instanceof CodeRunnerError);
  assert.equal(failure.status, 503);
  assert.match(failure.message, /Docker Desktop is not running/);
});

test('reports docker run start-up errors as a service error', () => {
  const failure = classifyDockerFailure(125, 'docker: Error response from daemon: pull access denied for missing-image.\n');
  assert.equal(failure?.status, 503);
});

test('passes ordinary program failures through unchanged', () => {
  assert.equal(classifyDockerFailure(1, 'Traceback (most recent call last):\nNameError: name \'x\' is not defined\n'), null);
  assert.equal(classifyDockerFailure(125, 'my program printed this and exited 125\n'), null);
  assert.equal(classifyDockerFailure(0, ''), null);
});
