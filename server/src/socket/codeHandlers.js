import { codeChangeSchema, languageChangeSchema, roomRefSchema } from '../validation/schemas.js';
import { createEventHandler } from './createEventHandler.js';

export function registerCodeHandlers(io, socket, { roomService, logger }) {
  const on = createEventHandler(socket, logger);

  on('code-change', codeChangeSchema, ({ roomId, delta, version }) => {
    const room = currentRoom(socket, roomService, roomId);
    if (!room) return;

    const result = roomService.applyChange(roomId, version, delta);
    if (result.status === 'stale') {
      socket.emit('force-resync', roomService.snapshot(room));
      return;
    }
    if (result.status === 'invalid') {
      socket.emit('document-error', { message: 'That edit could not be applied. Resyncing the document.' });
      socket.emit('force-resync', roomService.snapshot(room));
      return;
    }

    // The sender needs an acknowledgement to advance its local base version.
    socket.emit('change-accepted', { version: result.version });
    socket.to(roomId).emit('remote-change', { delta: result.delta, version: result.version });
  });

  on('request-resync', roomRefSchema, ({ roomId }) => {
    const room = currentRoom(socket, roomService, roomId);
    if (room) socket.emit('force-resync', roomService.snapshot(room));
  });

  on('language-change', languageChangeSchema, ({ roomId, language }) => {
    if (!currentRoom(socket, roomService, roomId)) return;
    roomService.setLanguage(roomId, language);
    socket.to(roomId).emit('language-changed', { language });
  });
}

// A socket may only act on the room it has joined.
function currentRoom(socket, roomService, roomId) {
  return socket.data.roomId === roomId ? roomService.getRoom(roomId) : undefined;
}
