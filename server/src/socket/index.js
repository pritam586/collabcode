import { Server } from 'socket.io';
import { registerCodeHandlers } from './codeHandlers.js';
import { registerCursorHandlers } from './cursorHandlers.js';
import { registerRoomHandlers } from './roomHandlers.js';

export function createSocketServer(httpServer, { corsOrigin, isAllowedOrigin }) {
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

  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket);
    registerCodeHandlers(io, socket);
    registerCursorHandlers(io, socket);
  });

  return io;
}
