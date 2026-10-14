import { sendSyncStep1 } from './yjsHandlers.js';

export const RATE_LIMITED_MESSAGE = 'You are sending updates too quickly, so some were skipped. Your editor will catch up automatically.';

// Caps how many events, and how many bytes of Yjs data, one socket may send per window. A
// normal client sends a few dozen small events per second at most while typing and moving
// the cursor; joining with a large offline document sends one big message. Excess events
// are dropped. When a document update is dropped, the server restarts the sync handshake
// once the window resets (not immediately, or the client's reply would be dropped too), and
// the client then resends whatever the server is missing.
export function limitEvents(socket, { roomService, logger, windowMs = 5000, maxEvents = 200, maxBytes = 4_000_000 }) {
  let windowStartedAt = Date.now();
  let count = 0;
  let bytes = 0;
  let warned = false;
  let resyncTimer = null;

  socket.on('disconnect', () => clearTimeout(resyncTimer));

  socket.use(([event, payload], next) => {
    const now = Date.now();
    if (now - windowStartedAt > windowMs) {
      windowStartedAt = now;
      count = 0;
      bytes = 0;
      warned = false;
    }

    count += 1;
    bytes += payload?.data?.byteLength ?? 0;
    if (count <= maxEvents && bytes <= maxBytes) {
      next();
      return;
    }

    if (!warned) {
      warned = true;
      logger.warn({ socketId: socket.id, event, count, bytes, windowMs }, 'Socket exceeded its event rate limit');
      socket.emit('server-error', { message: RATE_LIMITED_MESSAGE });
    }

    const roomId = socket.data.roomId;
    if (event !== 'yjs-sync' || payload?.roomId !== roomId || resyncTimer) return;
    resyncTimer = setTimeout(() => {
      resyncTimer = null;
      const room = roomService.getRoom(roomId);
      if (socket.connected && room && socket.data.roomId === roomId) sendSyncStep1(socket, room);
    }, windowStartedAt + windowMs - now + 1);
  });
}
