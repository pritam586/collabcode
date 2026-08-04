import { isSupportedLanguage } from '../config/collaboration.js';
import { applyDeltaToString, getOrCreateRoom, getRoomSnapshot, touchRoom } from '../state/roomStore.js';

export function registerCodeHandlers(io, socket) {
  socket.on('code-change', ({ roomId, delta, version } = {}) => {
    if (!isCurrentRoom(socket, roomId)) return;

    const room = getOrCreateRoom(roomId);
    if (version !== room.docVersion) {
      socket.emit('force-resync', getRoomSnapshot(room));
      return;
    }

    const updatedContent = applyDeltaToString(room.content, delta);
    if (updatedContent === null) {
      socket.emit('document-error', { message: 'That edit could not be applied. Resyncing the document.' });
      socket.emit('force-resync', getRoomSnapshot(room));
      return;
    }

    room.content = updatedContent;
    room.docVersion += 1;
    touchRoom(room);

    // The sender needs an acknowledgement to advance its local base version.
    socket.emit('change-accepted', { version: room.docVersion });
    socket.to(roomId).emit('remote-change', { delta, version: room.docVersion });
  });

  socket.on('request-resync', ({ roomId } = {}) => {
    if (!isCurrentRoom(socket, roomId)) return;
    socket.emit('force-resync', getRoomSnapshot(getOrCreateRoom(roomId)));
  });

  socket.on('language-change', ({ roomId, language } = {}) => {
    if (!isCurrentRoom(socket, roomId) || !isSupportedLanguage(language)) return;

    const room = getOrCreateRoom(roomId);
    room.language = language;
    touchRoom(room);
    socket.to(roomId).emit('language-changed', { language: room.language });
  });
}

function isCurrentRoom(socket, roomId) {
  return typeof roomId === 'string' && socket.data.roomId === roomId;
}
