import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, before, describe, test } from 'node:test';
import { io as connect } from 'socket.io-client';
import * as Y from 'yjs';
import { startTestServer } from './helpers.js';
import { YjsTestClient } from './yjsTestClient.js';

function waitFor(socket, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('socket events', () => {
  let server;
  const clients = [];
  const client = () => {
    const created = new YjsTestClient(server.url);
    clients.push(created);
    return created;
  };

  before(async () => {
    server = await startTestServer({ env: { MAX_PARTICIPANTS_PER_ROOM: '2' } });
  });
  after(() => server.close());
  afterEach(() => {
    for (const created of clients.splice(0)) created.close();
  });

  test('join-room syncs room details and announces the newcomer', async () => {
    const ada = client();
    const snapshot = await ada.join('join-test', 'Ada');
    assert.equal(snapshot.roomId, 'join-test');
    assert.equal(snapshot.language, 'javascript');
    assert.equal(snapshot.participants.length, 1);

    const announced = ada.waitFor('participant-joined');
    await client().join('join-test', 'Grace');
    const grace = await announced;
    assert.equal(grace.name, 'Grace');
    assert.ok(grace.color);
  });

  test('rejects invalid join payloads and full rooms with room-error', async () => {
    const ada = client();
    await ada.waitFor('connect');
    const invalid = ada.waitFor('room-error');
    ada.socket.emit('join-room', { roomId: 'bad room id!', name: 'Ada' });
    assert.match((await invalid).message, /room ID up to 64 characters/);

    await client().join('full-room', 'One');
    await client().join('full-room', 'Two');
    const third = client();
    await third.waitFor('connect');
    const full = third.waitFor('room-error');
    third.socket.emit('join-room', { roomId: 'full-room', name: 'Three' });
    assert.match((await full).message, /room is full. Up to 2 people/);
  });

  test('edits reach the other participant', async () => {
    const ada = client();
    const grace = client();
    await ada.join('edit-test', 'Ada');
    await grace.join('edit-test', 'Grace');

    ada.text.insert(0, 'hello');
    await grace.until(() => grace.text.toString() === 'hello');
    grace.text.insert(5, ' world');
    await ada.until(() => ada.text.toString() === 'hello world');
  });

  test('a late joiner receives the existing document', async () => {
    const ada = client();
    await ada.join('late-test', 'Ada');
    ada.text.insert(0, 'already here');
    await pause(50);

    const grace = client();
    await grace.join('late-test', 'Grace');
    assert.equal(grace.text.toString(), 'already here');
  });

  test('simultaneous edits converge to the same text', async () => {
    const ada = client();
    const grace = client();
    await ada.join('merge-test', 'Ada');
    await grace.join('merge-test', 'Grace');
    ada.text.insert(0, 'ac');
    await grace.until(() => grace.text.toString() === 'ac');

    // Both edit before seeing the other's change.
    ada.text.insert(1, 'b');
    grace.text.insert(2, 'd');
    await ada.until(() => ada.text.toString() === 'abcd');
    await grace.until(() => grace.text.toString() === 'abcd');
  });

  test('edits made while disconnected are merged on reconnect', async () => {
    const ada = client();
    const grace = client();
    await ada.join('offline-test', 'Ada');
    await grace.join('offline-test', 'Grace');
    ada.text.insert(0, 'base');
    await grace.until(() => grace.text.toString() === 'base');

    grace.socket.disconnect();
    grace.text.insert(4, ' offline');
    ada.text.insert(0, 'online ');
    await pause(50);

    await grace.reconnect();
    await ada.until(() => ada.text.toString() === 'online base offline');
    assert.equal(grace.text.toString(), 'online base offline');
  });

  test('sockets cannot edit a room they have not joined', async () => {
    const member = client();
    await member.join('private-test', 'Ada');

    const outsiderDoc = new Y.Doc();
    outsiderDoc.getText('content').insert(0, 'intrusion');
    const outsider = client();
    await outsider.waitFor('connect');
    outsider.socket.emit('yjs-sync', {
      roomId: 'private-test',
      data: encodeUpdateMessage(Y.encodeStateAsUpdate(outsiderDoc)),
    });
    await pause(150);
    assert.equal(member.text.toString(), '');
  });

  test('an edit past the document limit is rejected and the sender is told to reset', async () => {
    const ada = client();
    await ada.join('limit-test', 'Ada');
    ada.text.insert(0, 'x'.repeat(60_000));
    await ada.until(() => server.roomService.getRoom('limit-test').text.length === 60_000);

    const error = ada.waitFor('document-error');
    ada.text.insert(0, 'y'.repeat(50_000));
    const { message, reset } = await error;
    assert.match(message, /longer than 100,000 characters/);
    assert.equal(reset, true);
    assert.equal(server.roomService.getRoom('limit-test').text.length, 60_000);
  });

  test('a message over the size limit is rejected with a reset instead of being dropped silently', async () => {
    const ada = client();
    await ada.join('oversized-test', 'Ada');
    const error = ada.waitFor('document-error');
    ada.socket.emit('yjs-sync', { roomId: 'oversized-test', data: new Uint8Array(1_000_001) });
    assert.equal((await error).reset, true);
  });

  test('awareness shows cursors with the server-assigned name, even if the client lies', async () => {
    const ada = client();
    const grace = client();
    await ada.join('cursor-test', 'Ada');
    await grace.join('cursor-test', 'Grace');

    ada.awareness.setLocalState({ user: { name: 'Mallory' }, typing: true, cursor: null });
    await grace.until(() => grace.awareness.getStates().get(ada.doc.clientID)?.typing === true);
    const state = grace.awareness.getStates().get(ada.doc.clientID);
    assert.equal(state.user.name, 'Ada');
    assert.equal(state.user.socketId, ada.socket.id);

    ada.socket.disconnect();
    await grace.until(() => !grace.awareness.getStates().has(ada.doc.clientID));
  });

  test('language-change is broadcast and kept for later joiners', async () => {
    const ada = client();
    const grace = client();
    await ada.join('language-test', 'Ada');
    await grace.join('language-test', 'Grace');

    const changed = grace.waitFor('language-changed');
    ada.socket.emit('language-change', { roomId: 'language-test', language: 'python' });
    assert.deepEqual(await changed, { language: 'python' });

    grace.close();
    const late = client();
    assert.equal((await late.join('language-test', 'Linus')).language, 'python');
  });

  test('disconnecting announces participant-left', async () => {
    const ada = client();
    const grace = client();
    await ada.join('leave-test', 'Ada');
    await grace.join('leave-test', 'Grace');
    const left = ada.waitFor('participant-left');
    const graceId = grace.socket.id;
    grace.socket.disconnect();
    assert.deepEqual(await left, { socketId: graceId });
  });

  test('rejects WebSocket connections from foreign origins', async () => {
    const socket = connect(server.url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      extraHeaders: { Origin: 'https://evil.example.com' },
    });
    try {
      await waitFor(socket, 'connect_error');
    } finally {
      socket.disconnect();
    }
  });
});

function encodeUpdateMessage(update) {
  // y-protocols sync "update" message: type 2 followed by the length-prefixed update.
  const header = [2, ...varUint(update.byteLength)];
  return new Uint8Array([...header, ...update]);
}

function varUint(value) {
  const bytes = [];
  let remaining = value;
  while (remaining > 0x7f) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  bytes.push(remaining);
  return bytes;
}

test('room content survives a server restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'collabcode-test-'));
  const env = { DATABASE_PATH: join(directory, 'rooms.db') };
  try {
    const first = await startTestServer({ env });
    const ada = new YjsTestClient(first.url);
    await ada.join('durable', 'Ada');
    ada.text.insert(0, 'print("kept")');
    ada.socket.emit('language-change', { roomId: 'durable', language: 'python' });
    await pause(50);
    ada.close();
    await first.close();

    const second = await startTestServer({ env });
    const grace = new YjsTestClient(second.url);
    const snapshot = await grace.join('durable', 'Grace');
    assert.equal(grace.text.toString(), 'print("kept")');
    assert.equal(snapshot.language, 'python');
    grace.close();
    await second.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a client restores the room when the server has lost it', async () => {
  const first = await startTestServer();
  const ada = new YjsTestClient(first.url);
  await ada.join('lost', 'Ada');
  ada.text.insert(0, 'only Ada still has this');
  await pause(50);
  ada.socket.disconnect();
  await first.close();

  // A fresh in-memory server knows nothing about the room. Ada's client keeps its document.
  const second = await startTestServer();
  ada.url = second.url;
  await ada.reconnect();
  await ada.until(() => second.roomService.getRoom('lost')?.text.toString() === 'only Ada still has this');
  ada.close();
  await second.close();
});

test('sockets that flood events are throttled, then resynced once the window resets', async () => {
  const server = await startTestServer({ eventLimit: { maxEvents: 6, windowMs: 400 } });
  const ada = new YjsTestClient(server.url);
  try {
    await ada.join('flood-test', 'Ada');
    const warning = ada.waitFor('server-error');
    for (let index = 0; index < 10; index += 1) ada.text.insert(ada.text.length, String(index));

    assert.match((await warning).message, /too quickly/);
    await ada.until(() => server.roomService.getRoom('flood-test').text.toString() === '0123456789', 3000);
  } finally {
    ada.close();
    await server.close();
  }
});

describe('chat', () => {
  let server;
  const clients = [];
  const client = () => {
    const created = new YjsTestClient(server.url);
    clients.push(created);
    return created;
  };

  before(async () => {
    server = await startTestServer();
  });
  after(() => server.close());
  afterEach(() => {
    for (const created of clients.splice(0)) created.close();
  });

  test('messages reach everyone with the server-assigned author and time', async () => {
    const ada = client();
    const grace = client();
    await ada.join('chat-room', 'Ada');
    await grace.join('chat-room', 'Grace');

    const toAda = ada.waitFor('chat-message');
    const toGrace = grace.waitFor('chat-message');
    ada.socket.emit('chat-send', {
      roomId: 'chat-room',
      body: '  hello 👋  ',
      clientId: 'local-1',
      author: { name: 'Mallory' },
    });
    const [own, received] = await Promise.all([toAda, toGrace]);
    assert.equal(received.body, 'hello 👋');
    assert.equal(received.author.name, 'Ada');
    assert.equal(own.clientId, 'local-1');
    assert.ok(received.id > 0);
    assert.ok(Math.abs(received.createdAt - Date.now()) < 5000);
  });

  test('late joiners and restarted servers keep the history', async () => {
    const ada = client();
    await ada.join('history-room', 'Ada');
    for (const body of ['first', 'second']) {
      const delivered = ada.waitFor('chat-message');
      ada.socket.emit('chat-send', { roomId: 'history-room', body });
      await delivered;
    }

    const grace = client();
    const snapshot = await grace.join('history-room', 'Grace');
    assert.deepEqual(
      snapshot.messages.map((message) => message.body),
      ['first', 'second'],
    );
  });

  test('rejects empty, oversized and control-character messages with chat-error', async () => {
    const ada = client();
    await ada.join('invalid-chat', 'Ada');
    for (const body of ['   ', 'x'.repeat(1001), `bad${String.fromCharCode(7)}bell`]) {
      const error = ada.waitFor('chat-error');
      ada.socket.emit('chat-send', { roomId: 'invalid-chat', body });
      assert.ok((await error).message);
    }
  });

  test('limits each socket to 10 messages per 10 seconds', async () => {
    const ada = client();
    await ada.join('spam-room', 'Ada');
    let delivered = 0;
    ada.socket.on('chat-message', () => {
      delivered += 1;
    });
    const error = ada.waitFor('chat-error');
    for (let index = 0; index < 11; index += 1)
      ada.socket.emit('chat-send', { roomId: 'spam-room', body: `message ${index}` });
    assert.match((await error).message, /too quickly/);
    await ada.until(() => delivered === 10);
  });

  test('sockets outside the room cannot post', async () => {
    const member = client();
    await member.join('closed-chat', 'Ada');
    const outsider = client();
    await outsider.waitFor('connect');
    outsider.socket.emit('chat-send', { roomId: 'closed-chat', body: 'spam' });
    await pause(150);
    assert.equal(member.events.filter(({ event }) => event === 'chat-message').length, 0);
  });
});

test('chat history survives a server restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'collabcode-test-'));
  const env = { DATABASE_PATH: join(directory, 'rooms.db') };
  try {
    const first = await startTestServer({ env });
    const ada = new YjsTestClient(first.url);
    await ada.join('durable-chat', 'Ada');
    const delivered = ada.waitFor('chat-message');
    ada.socket.emit('chat-send', { roomId: 'durable-chat', body: 'still here?' });
    await delivered;
    ada.close();
    await first.close();

    const second = await startTestServer({ env });
    const grace = new YjsTestClient(second.url);
    const snapshot = await grace.join('durable-chat', 'Grace');
    assert.deepEqual(
      snapshot.messages.map((message) => [message.author.name, message.body]),
      [['Ada', 'still here?']],
    );
    grace.close();
    await second.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
