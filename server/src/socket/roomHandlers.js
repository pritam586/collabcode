import { z } from 'zod';
import { MAX_DISPLAY_NAME_LENGTH, MAX_ROOM_ID_LENGTH } from '../config/collaboration.js';
import { joinRoomSchema } from '../validation/schemas.js';
import { createEventHandler } from './createEventHandler.js';
import { sendSyncStep1 } from './yjsHandlers.js';

const INVALID_JOIN_MESSAGE = `Use a room ID up to ${MAX_ROOM_ID_LENGTH} characters (letters, numbers, dots, dashes, or underscores) and a display name up to ${MAX_DISPLAY_NAME_LENGTH} characters.`;

export function registerRoomHandlers(io, socket, { roomService, logger }) {
  const on = createEventHandler(socket, logger);

  on('join-room', joinRoomSchema, ({ roomId, name }) => {
    leaveCurrentRoom(socket, roomService);

    const result = roomService.join(roomId, socket.id, name);
    if (!result.ok) {
      socket.emit('room-error', { message: `This room is full. Up to ${result.maxParticipants} people can be in a room at once.` });
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.emit('room-sync', { roomId, ...roomService.snapshot(result.room) });
    socket.to(roomId).emit('participant-joined', { socketId: socket.id, ...result.participant });

    // Cursors are sent when the client asks for the document (its sync step 1).
    sendSyncStep1(socket, result.room);
  }, { onInvalid: () => socket.emit('room-error', { message: INVALID_JOIN_MESSAGE }) });

  on('leave-room', z.any(), () => leaveCurrentRoom(socket, roomService));

  socket.on('disconnect', () => {
    try {
      leaveCurrentRoom(socket, roomService);
    } catch (error) {
      logger.error({ err: error, socketId: socket.id }, 'Failed to leave room on disconnect');
    }
  });
}

function leaveCurrentRoom(socket, roomService) {
  const { roomId } = socket.data;
  if (!roomId) return;

  if (roomService.leave(roomId, socket.id)) {
    socket.to(roomId).emit('participant-left', { socketId: socket.id });
  }
  socket.leave(roomId);
  socket.data.roomId = undefined;
}
