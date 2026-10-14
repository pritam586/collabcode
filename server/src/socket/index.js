import { Server } from 'socket.io';
import { encodeAwarenessUpdate } from 'y-protocols/awareness';
import { SOCKET_BUFFER_BYTES } from '../config/collaboration.js';
import { registerLanguageHandlers } from './languageHandlers.js';
import { limitEvents } from './limitEvents.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerYjsHandlers } from './yjsHandlers.js';
import { encodeUpdate } from './yjsProtocol.js';

export function createSocketServer(httpServer, { corsOrigin, isAllowedOrigin, roomService, logger, eventLimit }) {
  const io = new Server(httpServer, {
    maxHttpBufferSize: SOCKET_BUFFER_BYTES,
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
    // CORS does not apply to WebSocket upgrades, so check the browser origin explicitly.
    allowRequest: (request, callback) => {
      const { origin } = request.headers;
      callback(null, !origin || isAllowedOrigin(origin));
    },
  });

  // Relay every accepted change to the rest of the room. The sender already has it.
  const roomExceptOrigin = (room, origin) => (io.sockets.sockets.has(origin) ? io.to(room.id).except(origin) : io.to(room.id));
  roomService.on('document-update', (room, update, origin) => {
    roomExceptOrigin(room, origin).emit('yjs-sync', { roomId: room.id, data: encodeUpdate(update) });
  });
  roomService.on('awareness-update', (room, clientIds, origin) => {
    roomExceptOrigin(room, origin).emit('yjs-awareness', { roomId: room.id, data: encodeAwarenessUpdate(room.awareness, clientIds) });
  });

  const context = { roomService, logger };
  io.on('connection', (socket) => {
    limitEvents(socket, { roomService, logger, ...eventLimit });
    registerRoomHandlers(io, socket, context);
    registerYjsHandlers(io, socket, context);
    registerLanguageHandlers(io, socket, context);
  });

  return io;
}
