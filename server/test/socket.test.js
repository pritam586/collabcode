import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, before, describe, test } from 'node:test';
import { io as connect } from 'socket.io-client';
import { startTestServer } from './helpers.js';

const insertAt = (text, line = 1, column = 1) => ({
  range: { startLineNumber: line, startColumn: column, endLineNumber: line, endColumn: column },
  text,
});

function waitFor(socket, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

// Resolves true if the event does NOT arrive within the window.
function staysQuiet(socket, event, windowMs = 250) {
  return new Promise((resolve) => {
    const listener = () => resolve(false);
    socket.once(event, listener);
    setTimeout(() => {
      socket.off(event, listener);
      resolve(true);
    }, windowMs);
  });
}

function createClients(url) {
  const sockets = [];
  return {
    async connect(options = {}) {
      const socket = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false, ...options });
      sockets.push(socket);
      await waitFor(socket, 'connect');
      return socket;
    },
    async join(roomId, name = 'Ada') {
      const socket = await this.connect();
      const synced = waitFor(socket, 'room-sync');
      socket.emit('join-room', { roomId, name });
      return { socket, snapshot: await synced };
    },
    closeAll() {
      for (const socket of sockets.splice(0)) socket.disconnect();
    },
  };
}

describe('socket events', () => {
  let server;
  let clients;

  before(async () => {
    server = await startTestServer({ env: { MAX_PARTICIPANTS_PER_ROOM: '2' } });
  });
  after(() => server.close());
  afterEach(() => clients?.closeAll());

  test('join-room syncs the room and announces the newcomer', async () => {
    clients = createClients(server.url);
    const { socket: ada, snapshot } = await clients.join('join-test', 'Ada');
    assert.deepEqual({ ...snapshot, participants: snapshot.participants.length }, {
      roomId: 'join-test', content: '', version: 0, language: 'javascript', participants: 1,
    });

    const announced = waitFor(ada, 'participant-joined');
    await clients.join('join-test', 'Grace');
    const grace = await announced;
    assert.equal(grace.name, 'Grace');
    assert.ok(grace.color);
  });

  test('rejects invalid join payloads and full rooms with room-error', async () => {
    clients = createClients(server.url);
    const socket = await clients.connect();
    const invalid = waitFor(socket, 'room-error');
    socket.emit('join-room', { roomId: 'bad room id!', name: 'Ada' });
    assert.match((await invalid).message, /room ID up to 64 characters/);

    await clients.join('full-room', 'One');
    await clients.join('full-room', 'Two');
    const third = await clients.connect();
    const full = waitFor(third, 'room-error');
    third.emit('join-room', { roomId: 'full-room', name: 'Three' });
    assert.match((await full).message, /room is full. Up to 2 people/);
  });

  test('code-change is acknowledged to the sender and broadcast to others', async () => {
    clients = createClients(server.url);
    const { socket: ada } = await clients.join('edit-test', 'Ada');
    const { socket: grace } = await clients.join('edit-test', 'Grace');

    const accepted = waitFor(ada, 'change-accepted');
    const remote = waitFor(grace, 'remote-change');
    ada.emit('code-change', { roomId: 'edit-test', version: 0, delta: { ...insertAt('hello'), injected: '<script>' } });

    assert.deepEqual(await accepted, { version: 1 });
    assert.deepEqual(await remote, { delta: insertAt('hello'), version: 1 });
  });

  test('a stale version gets force-resync with the current document', async () => {
    clients = createClients(server.url);
    const { socket: ada } = await clients.join('stale-test', 'Ada');
    const { socket: grace } = await clients.join('stale-test', 'Grace');

    const accepted = waitFor(ada, 'change-accepted');
    ada.emit('code-change', { roomId: 'stale-test', version: 0, delta: insertAt('first') });
    await accepted;

    const resync = waitFor(grace, 'force-resync');
    grace.emit('code-change', { roomId: 'stale-test', version: 0, delta: insertAt('second') });
    const snapshot = await resync;
    assert.equal(snapshot.content, 'first');
    assert.equal(snapshot.version, 1);
  });

  test('an invalid delta gets document-error and force-resync', async () => {
    clients = createClients(server.url);
    const { socket } = await clients.join('invalid-delta', 'Ada');
    const error = waitFor(socket, 'document-error');
    const resync = waitFor(socket, 'force-resync');
    socket.emit('code-change', { roomId: 'invalid-delta', version: 0, delta: insertAt('x', 5, 1) });
    assert.match((await error).message, /could not be applied/);
    assert.equal((await resync).version, 0);
  });

  test('sockets cannot edit a room they have not joined', async () => {
    clients = createClients(server.url);
    const { socket: member } = await clients.join('private-test', 'Ada');
    const outsider = await clients.connect();
    outsider.emit('code-change', { roomId: 'private-test', version: 0, delta: insertAt('intrusion') });
    assert.equal(await staysQuiet(member, 'remote-change'), true);
  });

  test('cursor-update relays valid selections with the sender name and color', async () => {
    clients = createClients(server.url);
    const { socket: ada } = await clients.join('cursor-test', 'Ada');
    const { socket: grace } = await clients.join('cursor-test', 'Grace');
    const position = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };

    const relayed = waitFor(grace, 'remote-cursor');
    ada.emit('cursor-update', { roomId: 'cursor-test', position });
    const cursor = await relayed;
    assert.equal(cursor.name, 'Ada');
    assert.deepEqual(cursor.position, position);

    ada.emit('cursor-update', { roomId: 'cursor-test', position: { ...position, startLineNumber: 3 } });
    assert.equal(await staysQuiet(grace, 'remote-cursor'), true, 'backwards selections are ignored');
  });

  test('language-change is broadcast and kept in the room snapshot', async () => {
    clients = createClients(server.url);
    const { socket: ada } = await clients.join('language-test', 'Ada');
    const { socket: grace } = await clients.join('language-test', 'Grace');

    const changed = waitFor(grace, 'language-changed');
    ada.emit('language-change', { roomId: 'language-test', language: 'python' });
    assert.deepEqual(await changed, { language: 'python' });

    const resync = waitFor(grace, 'force-resync');
    grace.emit('request-resync', { roomId: 'language-test' });
    assert.equal((await resync).language, 'python');
  });

  test('disconnecting announces participant-left', async () => {
    clients = createClients(server.url);
    const { socket: ada } = await clients.join('leave-test', 'Ada');
    const { socket: grace } = await clients.join('leave-test', 'Grace');
    const left = waitFor(ada, 'participant-left');
    const graceId = grace.id;
    grace.disconnect();
    assert.deepEqual(await left, { socketId: graceId });
  });

  test('rejects WebSocket connections from foreign origins', async () => {
    const socket = connect(server.url, {
      transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: { Origin: 'https://evil.example.com' },
    });
    try {
      await waitFor(socket, 'connect_error');
    } finally {
      socket.disconnect();
    }
  });
});

test('room content survives a server restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'collabcode-test-'));
  const env = { DATABASE_PATH: join(directory, 'rooms.db') };
  try {
    const first = await startTestServer({ env });
    const firstClients = createClients(first.url);
    const { socket } = await firstClients.join('durable', 'Ada');
    const accepted = waitFor(socket, 'change-accepted');
    socket.emit('code-change', { roomId: 'durable', version: 0, delta: insertAt('print("kept")') });
    await accepted;
    socket.emit('language-change', { roomId: 'durable', language: 'python' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    firstClients.closeAll();
    await first.close();

    const second = await startTestServer({ env });
    const secondClients = createClients(second.url);
    const { snapshot } = await secondClients.join('durable', 'Ada');
    assert.equal(snapshot.content, 'print("kept")');
    assert.equal(snapshot.language, 'python');
    assert.equal(snapshot.version, 1);
    secondClients.closeAll();
    await second.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('sockets that flood events are throttled, and dropped edits are answered with a resync', async () => {
  const server = await startTestServer({ eventLimit: { maxEvents: 4, windowMs: 60_000 } });
  const clients = createClients(server.url);
  try {
    const { socket } = await clients.join('flood-test', 'Ada');
    const warning = waitFor(socket, 'server-error');
    const resync = waitFor(socket, 'force-resync');
    const position = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
    for (let index = 0; index < 4; index += 1) socket.emit('cursor-update', { roomId: 'flood-test', position });
    socket.emit('code-change', { roomId: 'flood-test', version: 0, delta: insertAt('x') });

    assert.match((await warning).message, /too quickly/);
    assert.equal((await resync).version, 0);
  } finally {
    clients.closeAll();
    await server.close();
  }
});
