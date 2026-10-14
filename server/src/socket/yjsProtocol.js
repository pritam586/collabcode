import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';

// Message builders for the y-protocols sync encoding carried in `yjs-sync` events.

export function encodeSyncStep1(doc) {
  const encoder = encoding.createEncoder();
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

export function encodeSyncStep2(doc, stateVector) {
  const encoder = encoding.createEncoder();
  syncProtocol.writeSyncStep2(encoder, doc, stateVector);
  return encoding.toUint8Array(encoder);
}

export function encodeUpdate(update) {
  const encoder = encoding.createEncoder();
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

export function encodeAllAwareness(awareness) {
  const clientIds = [...awareness.getStates().keys()];
  return clientIds.length > 0 ? encodeAwarenessUpdate(awareness, clientIds) : null;
}

// Splits a sync message into { type: 'step1', stateVector } or { type: 'update', update }.
// Step 2 and plain updates are handled the same way: both carry a Yjs update.
// Throws on malformed input.
export function decodeSyncMessage(data) {
  const decoder = decoding.createDecoder(data);
  const messageType = decoding.readVarUint(decoder);
  const payload = decoding.readVarUint8Array(decoder);
  if (messageType === syncProtocol.messageYjsSyncStep1) return { type: 'step1', stateVector: payload };
  if (messageType === syncProtocol.messageYjsSyncStep2 || messageType === syncProtocol.messageYjsUpdate) {
    return { type: 'update', update: payload };
  }
  throw new Error(`Unknown Yjs sync message type ${messageType}`);
}
