import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import { describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';
import { SocketYjsProvider } from './SocketYjsProvider.js';

// A stand-in for the Socket.io client: records what the provider sends and lets the test
// deliver server events.
function createFakeSocket() {
  const listeners = new Map();
  return {
    sent: [],
    on(event, listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    off(event, listener) {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((item) => item !== listener),
      );
    },
    emit(event, payload) {
      this.sent.push({ event, payload });
    },
    deliver(event, payload) {
      for (const listener of listeners.get(event) ?? []) listener(payload);
    },
    listenerCount: (event) => (listeners.get(event) ?? []).length,
  };
}

const messageType = (data) => decoding.readVarUint(decoding.createDecoder(data));

function syncStep2From(serverDoc) {
  const encoder = encoding.createEncoder();
  syncProtocol.writeSyncStep2(encoder, serverDoc);
  return encoding.toUint8Array(encoder);
}

describe('SocketYjsProvider', () => {
  test('start() asks for the document and becomes synced when it arrives', () => {
    const socket = createFakeSocket();
    const provider = new SocketYjsProvider(socket, 'room-1');
    const onSynced = vi.fn();
    provider.on('synced', onSynced);

    provider.start();
    expect(socket.sent[0].event).toBe('yjs-sync');
    expect(socket.sent[0].payload.roomId).toBe('room-1');
    expect(messageType(socket.sent[0].payload.data)).toBe(syncProtocol.messageYjsSyncStep1);

    const serverDoc = new Y.Doc();
    serverDoc.getText('content').insert(0, 'hello from the server');
    socket.deliver('yjs-sync', { roomId: 'room-1', data: syncStep2From(serverDoc) });

    expect(provider.text.toString()).toBe('hello from the server');
    expect(provider.synced).toBe(true);
    expect(onSynced).toHaveBeenCalledOnce();
    provider.destroy();
  });

  test('ignores messages for other rooms', () => {
    const socket = createFakeSocket();
    const provider = new SocketYjsProvider(socket, 'room-1');
    const serverDoc = new Y.Doc();
    serverDoc.getText('content').insert(0, 'wrong room');
    socket.deliver('yjs-sync', { roomId: 'room-2', data: syncStep2From(serverDoc) });
    expect(provider.text.toString()).toBe('');
    provider.destroy();
  });

  test('sends local edits only after joining', () => {
    const socket = createFakeSocket();
    const provider = new SocketYjsProvider(socket, 'room-1');

    provider.text.insert(0, 'offline edit');
    expect(socket.sent).toHaveLength(0);

    provider.start();
    socket.sent.length = 0;
    provider.text.insert(0, '> ');
    expect(socket.sent).toHaveLength(1);
    expect(messageType(socket.sent[0].payload.data)).toBe(syncProtocol.messageYjsUpdate);
    provider.destroy();
  });

  test("answers the server's sync step 1 with what the server is missing", () => {
    const socket = createFakeSocket();
    const provider = new SocketYjsProvider(socket, 'room-1');
    provider.text.insert(0, 'only the client has this');
    provider.start();
    socket.sent.length = 0;

    const serverDoc = new Y.Doc();
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, serverDoc);
    socket.deliver('yjs-sync', { roomId: 'room-1', data: encoding.toUint8Array(encoder) });

    const reply = socket.sent.find(({ event }) => event === 'yjs-sync');
    expect(messageType(reply.payload.data)).toBe(syncProtocol.messageYjsSyncStep2);
    syncProtocol.readSyncMessage(
      decoding.createDecoder(reply.payload.data),
      encoding.createEncoder(),
      serverDoc,
      'test',
    );
    expect(serverDoc.getText('content').toString()).toBe('only the client has this');
    provider.destroy();
  });

  test('refuses to send messages over the size limit and reports it', () => {
    const socket = createFakeSocket();
    const provider = new SocketYjsProvider(socket, 'room-1');
    const onTooLarge = vi.fn();
    provider.on('too-large', onTooLarge);
    provider.start();
    socket.sent.length = 0;

    provider.text.insert(0, 'x'.repeat(1_000_001));
    expect(onTooLarge).toHaveBeenCalledOnce();
    expect(socket.sent).toHaveLength(0);
    provider.destroy();
  });

  test('forgets other people’s cursors when the connection drops', () => {
    const socket = createFakeSocket();
    const provider = new SocketYjsProvider(socket, 'room-1');
    provider.start();

    const remote = new Awareness(new Y.Doc());
    remote.setLocalState({ user: { name: 'Grace' }, typing: true });
    socket.deliver('yjs-awareness', { roomId: 'room-1', data: encodeAwarenessUpdate(remote, [remote.clientID]) });
    expect(provider.awareness.getStates().has(remote.clientID)).toBe(true);

    socket.deliver('disconnect');
    expect(provider.awareness.getStates().has(remote.clientID)).toBe(false);
    remote.destroy();
    provider.destroy();
  });

  test('destroy() removes its socket listeners', () => {
    const socket = createFakeSocket();
    const provider = new SocketYjsProvider(socket, 'room-1');
    provider.destroy();
    expect(socket.listenerCount('yjs-sync')).toBe(0);
    expect(socket.listenerCount('yjs-awareness')).toBe(0);
    expect(() => provider.on('synced', () => {})()).not.toThrow();
  });
});
