import { cursorUpdateSchema } from '../validation/schemas.js';
import { createEventHandler } from './createEventHandler.js';

export function registerCursorHandlers(io, socket, { roomService, logger }) {
  const on = createEventHandler(socket, logger);

  on('cursor-update', cursorUpdateSchema, ({ roomId, position }) => {
    if (socket.data.roomId !== roomId) return;

    const participant = roomService.updateCursor(roomId, socket.id, position);
    if (!participant) return;

    socket.to(roomId).emit('remote-cursor', {
      socketId: socket.id,
      position,
      name: participant.name,
      color: participant.color,
    });
  });
}
