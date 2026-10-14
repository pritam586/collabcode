import { Server } from 'socket.io';
import { registerCodeHandlers } from './codeHandlers.js';
import { registerCursorHandlers } from './cursorHandlers.js';
import { limitEvents } from './limitEvents.js';
import { registerRoomHandlers } from './roomHandlers.js';

export function createSocketServer(httpServer, { corsOrigin, isAllowedOrigin, roomService, logger, eventLimit }) {
  const io = new Server(httpServer, {
    maxHttpBufferSize: 110_000,
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

  const context = { roomService, logger };
  io.on('connection', (socket) => {
    limitEvents(socket, { roomService, logger, ...eventLimit });
    registerRoomHandlers(io, socket, context);
    registerCodeHandlers(io, socket, context);
    registerCursorHandlers(io, socket, context);
  });

  return io;
}
