import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { CodeRunnerError } from '../src/services/codeRunner.js';
import { startTestServer } from './helpers.js';

describe('HTTP API', () => {
  let server;
  let nextRunResult;

  before(async () => {
    server = await startTestServer({
      runCode: async (language, code) => {
        if (nextRunResult instanceof Error) throw nextRunResult;
        return nextRunResult ?? { stdout: `${language}:${code}`, stderr: '', exitCode: 0 };
      },
    });
  });
  after(() => server.close());

  const post = (path, body, headers = {}) => fetch(`${server.url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

  test('GET /health reports ok with security headers and a request id', async () => {
    const response = await fetch(`${server.url}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'ok');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('content-security-policy'));
    assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
    assert.equal(response.headers.get('x-powered-by'), null);
  });

  test('allows configured browser origins only', async () => {
    const allowed = await fetch(`${server.url}/health`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const blocked = await fetch(`${server.url}/health`, { headers: { Origin: 'https://evil.example.com' } });
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  });

  test('POST /api/run returns the runner result', async () => {
    nextRunResult = undefined;
    const response = await post('/api/run', { language: 'python', code: 'print(1)' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { stdout: 'python:print(1)', stderr: '', exitCode: 0 });
  });

  test('runner errors keep their status and friendly message', async () => {
    nextRunResult = new CodeRunnerError('Docker Desktop is not running. Start Docker Desktop and try again.', 503);
    const response = await post('/api/run', { language: 'python', code: 'print(1)' });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /Docker Desktop is not running/);
  });

  test('unexpected errors become a generic 500 without internal details', async () => {
    nextRunResult = new Error('database password is hunter2');
    const response = await post('/api/run', { language: 'python', code: 'print(1)' });
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.doesNotMatch(body.error, /hunter2/);
    assert.ok(body.requestId);
  });

  test('malformed and oversized bodies get friendly 4xx errors', async () => {
    const malformed = await post('/api/run', '{"language":');
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, 'The request body must be valid JSON.');

    const oversized = await post('/api/run', { language: 'python', code: 'x'.repeat(120_000) });
    assert.equal(oversized.status, 413);
  });

  test('unknown routes return a JSON 404', async () => {
    const response = await fetch(`${server.url}/nope`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'Not found.');
  });
});

test('POST /api/run is limited to 10 requests per minute per address', async () => {
  const server = await startTestServer({ runCode: async () => ({ stdout: '', stderr: '', exitCode: 0 }) });
  try {
    const statuses = [];
    for (let index = 0; index < 11; index += 1) {
      const response = await fetch(`${server.url}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python', code: 'print(1)' }),
      });
      statuses.push(response.status);
      if (response.status === 429) assert.equal(response.headers.get('retry-after'), '60');
    }
    assert.deepEqual(statuses, [...Array(10).fill(200), 429]);
  } finally {
    await server.close();
  }
});

test('POST /api/run validates the body before calling the runner', async () => {
  let calls = 0;
  const server = await startTestServer({ runCode: async () => { calls += 1; return { stdout: '', stderr: '', exitCode: 0 }; } });
  try {
    const send = (body) => fetch(`${server.url}/api/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    const badLanguage = await send({ language: 'ruby', code: 'puts 1' });
    assert.equal(badLanguage.status, 400);
    assert.match((await badLanguage.json()).error, /Only Java, TypeScript, Python, and C\+\+/);

    const emptyCode = await send({ language: 'python', code: '' });
    assert.equal(emptyCode.status, 400);
    assert.match((await emptyCode.json()).error, /Code must be between 1 and 25000 characters/);

    const missingCode = await send({ language: 'python' });
    assert.equal(missingCode.status, 400);
    assert.equal(calls, 0);
  } finally {
    await server.close();
  }
});
