import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

// Must match MAX_YJS_MESSAGE_BYTES on the server. Larger messages are refused there, so the
// client resets instead of sending them.
const MAX_MESSAGE_BYTES = 1_000_000;
const REMOTE = 'remote';

// Keeps one room's Yjs document and awareness (cursors) in sync over the app's Socket.io
// connection, using the y-protocols sync and awareness encodings.
//
// The document outlives disconnects: edits made offline stay in `doc` and are merged when
// start() runs again after the next room-sync. Listen with on('synced' | 'too-large', fn).
export class SocketYjsProvider {
  constructor(socket, roomId) {
    this.socket = socket;
    this.roomId = roomId;
    this.doc = new Y.Doc();
    this.text = this.doc.getText('content');
    this.awareness = new Awareness(this.doc);
    this.joined = false;
    this.synced = false;
    this.listeners = new Map();

    this.handleSync = ({ roomId, data }) => {
      if (roomId !== this.roomId) return;
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const encoder = encoding.createEncoder();
      const messageType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, REMOTE);
      if (encoding.length(encoder) > 0) this.send('yjs-sync', encoding.toUint8Array(encoder));
      if (messageType === syncProtocol.messageYjsSyncStep2 && !this.synced) {
        this.synced = true;
        this.emit('synced');
      }
    };
    this.handleAwareness = ({ roomId, data }) => {
      if (roomId === this.roomId) applyAwarenessUpdate(this.awareness, new Uint8Array(data), REMOTE);
    };
    this.handleDisconnect = () => {
      this.joined = false;
      // Other people's cursors are stale while offline; the server resends them on rejoin.
      const remoteIds = [...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID);
      removeAwarenessStates(this.awareness, remoteIds, REMOTE);
    };
    this.handleDocUpdate = (update, origin) => {
      if (origin === REMOTE || !this.joined) return;
      const encoder = encoding.createEncoder();
      syncProtocol.writeUpdate(encoder, update);
      this.send('yjs-sync', encoding.toUint8Array(encoder));
    };
    this.handleAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin === REMOTE || !this.joined) return;
      const changed = [...added, ...updated, ...removed].filter((id) => id === this.doc.clientID);
      if (changed.length > 0) this.send('yjs-awareness', encodeAwarenessUpdate(this.awareness, changed));
    };

    socket.on('yjs-sync', this.handleSync);
    socket.on('yjs-awareness', this.handleAwareness);
    socket.on('disconnect', this.handleDisconnect);
    this.doc.on('update', this.handleDocUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);
  }

  // Call after every room-sync: the first join and each rejoin after a reconnect. Sends our
  // state vector so the server replies with what we are missing; the server's own step 1
  // makes us send what it is missing (offline edits, or edits the server lost).
  start() {
    this.joined = true;
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.send('yjs-sync', encoding.toUint8Array(encoder));
    if (this.awareness.getLocalState() !== null) {
      this.send('yjs-awareness', encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
    }
  }

  send(event, data) {
    if (!this.joined) return;
    if (data.byteLength > MAX_MESSAGE_BYTES) {
      this.emit('too-large');
      return;
    }
    this.socket.emit(event, { roomId: this.roomId, data });
  }

  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener);
    // Safe to call after destroy(), which React cleanup may do.
    return () => this.listeners.get(event)?.delete(listener);
  }

  emit(event) {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }

  destroy() {
    // Tell the others our cursor is gone before going quiet.
    this.awareness.setLocalState(null);
    this.joined = false;
    this.socket.off('yjs-sync', this.handleSync);
    this.socket.off('yjs-awareness', this.handleAwareness);
    this.socket.off('disconnect', this.handleDisconnect);
    this.listeners.clear();
    this.awareness.destroy();
    this.doc.destroy();
  }
}
