import { getOrCreateRoom } from '../state/roomStore.js';

export function registerCursorHandlers(io, socket) {
  socket.on('cursor-update', ({ roomId, position } = {}) => {
    if (socket.data.roomId !== roomId || !isValidSelection(position)) return;

    const room = getOrCreateRoom(roomId);
    const participant = room.participants.get(socket.id);
    if (!participant) return;

    participant.cursor = position;
    socket.to(roomId).emit('remote-cursor', {
      socketId: socket.id,
      position,
      name: participant.name,
      color: participant.color,
    });
  });
}

function isValidSelection(position) {
  if (!position || typeof position !== 'object') return false;
  return [
    position.startLineNumber,
    position.startColumn,
    position.endLineNumber,
    position.endColumn,
  ].every((value) => Number.isInteger(value) && value > 0)
    && (position.startLineNumber < position.endLineNumber
      || (position.startLineNumber === position.endLineNumber && position.startColumn <= position.endColumn));
}
