import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { io as connect } from 'socket.io-client';
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

const REMOTE = 'remote';

// A minimal headless CollabCode client speaking the same protocol as the browser provider.
export class YjsTestClient {
  constructor(url, { doc = new Y.Doc() } = {}) {
    this.url = url;
    this.doc = doc;
    this.text = doc.getText('content');
    this.awareness = new Awareness(doc);
    this.roomId = null;
    this.joined = false;
    this.events = [];
    this.connect();

    doc.on('update', (update, origin) => {
      if (origin === REMOTE || !this.joined) return;
      const encoder = encoding.createEncoder();
      syncProtocol.writeUpdate(encoder, update);
      this.socket.emit('yjs-sync', { roomId: this.roomId, data: encoding.toUint8Array(encoder) });
    });
    this.awareness.on('update', ({ added, updated, removed }, origin) => {
      if (origin === REMOTE || !this.joined) return;
      const changed = [...added, ...updated, ...removed].filter((id) => id === this.doc.clientID);
      if (changed.length > 0)
        this.socket.emit('yjs-awareness', {
          roomId: this.roomId,
          data: encodeAwarenessUpdate(this.awareness, changed),
        });
    });
  }

  connect() {
    this.socket = connect(this.url, { transports: ['websocket'], forceNew: true, reconnection: false });
    this.socket.onAny((event, payload) => this.events.push({ event, payload }));
    this.socket.on('disconnect', () => {
      this.joined = false;
    });
    this.socket.on('yjs-sync', ({ data }) => this.handleSync(new Uint8Array(data)));
    this.socket.on('yjs-awareness', ({ data }) => applyAwarenessUpdate(this.awareness, new Uint8Array(data), REMOTE));
  }

  handleSync(data) {
    const decoder = decoding.createDecoder(data);
    const encoder = encoding.createEncoder();
    const messageType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, REMOTE);
    if (encoding.length(encoder) > 0)
      this.socket.emit('yjs-sync', { roomId: this.roomId, data: encoding.toUint8Array(encoder) });
    if (messageType === syncProtocol.messageYjsSyncStep2) this.synced = true;
  }

  async join(roomId, name = 'Ada') {
    if (!this.socket.connected) await this.waitFor('connect');
    this.roomId = roomId;
    this.synced = false;
    const synced = this.waitFor('room-sync');
    this.socket.emit('join-room', { roomId, name });
    this.snapshot = await synced;
    this.joined = true;

    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.socket.emit('yjs-sync', { roomId, data: encoding.toUint8Array(encoder) });
    if (this.awareness.getLocalState()) this.awareness.setLocalState(this.awareness.getLocalState());
    await this.until(() => this.synced);
    return this.snapshot;
  }

  async reconnect() {
    this.socket.disconnect();
    this.connect();
    await this.waitFor('connect');
    return this.join(this.roomId);
  }

  waitFor(event, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
      this.socket.once(event, (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  async until(predicate, timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error('Timed out waiting for condition');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  close() {
    this.socket.disconnect();
    this.awareness.destroy();
    this.doc.destroy();
  }
}
