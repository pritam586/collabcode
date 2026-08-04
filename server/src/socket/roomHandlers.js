import { getOrCreateRoom, getRoomSnapshot } from '../state/roomStore.js';
import { assignColor } from '../utils/colorAssigner.js';

export function registerRoomHandlers(io, socket) {
  socket.on('join-room', (payload = {}) => {
    const roomId = sanitize(payload.roomId, 64);
    const name = sanitize(payload.name, 32);

    if (!roomId || !name) {
      socket.emit('room-error', { message: 'A room name and display name are required.' });
      return;
    }

    leaveCurrentRoom(io, socket);

    const room = getOrCreateRoom(roomId);
    const color = assignColor(room);
    const participant = { name, color, cursor: null };

    room.participants.set(socket.id, participant);
    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit('room-sync', { roomId, ...getRoomSnapshot(room) });
    socket.to(roomId).emit('participant-joined', { socketId: socket.id, ...participant });
  });

  socket.on('leave-room', () => leaveCurrentRoom(io, socket));
  socket.on('disconnect', () => leaveCurrentRoom(io, socket));
}

export function leaveCurrentRoom(io, socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const room = getOrCreateRoom(roomId);
  if (room.participants.delete(socket.id)) {
    socket.to(roomId).emit('participant-left', { socketId: socket.id });
  }

  socket.leave(roomId);
  socket.data.roomId = undefined;
}

function sanitize(value, maximumLength) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}
