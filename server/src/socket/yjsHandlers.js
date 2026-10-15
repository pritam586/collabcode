import { yjsMessageSchema } from '../validation/schemas.js';
import { createEventHandler } from './createEventHandler.js';
import { decodeSyncMessage, encodeAllAwareness, encodeSyncStep1, encodeSyncStep2 } from './yjsProtocol.js';

export const DOCUMENT_TOO_LARGE_MESSAGE =
  'That change would make the file longer than 100,000 characters, so it was not saved. Your editor was reset to the shared version.';
export const DOCUMENT_INVALID_MESSAGE =
  'A change could not be applied, so your editor was reset to the shared version.';

// Carries Yjs document sync (y-protocols sync messages) and awareness (cursors, typing).
// Updates accepted here are broadcast to the rest of the room by the listener in socket/index.js.
export function registerYjsHandlers(io, socket, { roomService, logger }) {
  const on = createEventHandler(socket, logger);

  on(
    'yjs-sync',
    yjsMessageSchema,
    ({ roomId, data }) => {
      const room = socket.data.roomId === roomId ? roomService.getRoom(roomId) : undefined;
      if (!room) return;

      let message;
      try {
        message = decodeSyncMessage(data);
      } catch (error) {
        logger.warn({ err: error, socketId: socket.id, roomId }, 'Ignored malformed Yjs sync message');
        return;
      }

      if (message.type === 'step1') {
        socket.emit('yjs-sync', { roomId, data: encodeSyncStep2(room.doc, message.stateVector) });
        // A client asking for the document also needs everyone's current cursors.
        const awareness = encodeAllAwareness(room.awareness);
        if (awareness) socket.emit('yjs-awareness', { roomId, data: awareness });
        return;
      }

      const result = roomService.applyUpdate(roomId, message.update, socket.id);
      if (result.status === 'accepted') return;

      // The client already applied this change locally, and a Yjs update cannot be taken back,
      // so the client must throw its copy away and resync from the server's document.
      socket.emit('document-error', {
        message: result.status === 'too-large' ? DOCUMENT_TOO_LARGE_MESSAGE : DOCUMENT_INVALID_MESSAGE,
        reset: true,
      });
    },
    {
      // Usually a message over the size limit. The client already applied it locally, so it
      // must reset too, or it would silently drift away from everyone else.
      onInvalid: () => {
        if (socket.data.roomId) socket.emit('document-error', { message: DOCUMENT_TOO_LARGE_MESSAGE, reset: true });
      },
    },
  );

  on('yjs-awareness', yjsMessageSchema, ({ roomId, data }) => {
    if (socket.data.roomId !== roomId) return;
    roomService.applyAwareness(roomId, socket.id, data);
  });
}

// Starts the two-way handshake for a socket that just joined: the server sends its state
// vector (step 1), and the client answers with everything the server is missing (step 2),
// which is how edits made offline or lost by the server are recovered.
export function sendSyncStep1(socket, room) {
  socket.emit('yjs-sync', { roomId: room.id, data: encodeSyncStep1(room.doc) });
}
