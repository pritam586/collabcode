import { registerCodeHandlers } from './codeHandlers.js';
import { registerCursorHandlers } from './cursorHandlers.js';
import { registerRoomHandlers } from './roomHandlers.js';

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket);
    registerCodeHandlers(io, socket);
    registerCursorHandlers(io, socket);
  });
}
