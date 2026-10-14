export const RATE_LIMITED_MESSAGE = 'You are sending updates too quickly, so some were skipped. Your editor will resync.';

// Caps how many events one socket may send per window. A normal client sends at most ~30 per
// second while typing and moving the cursor. Excess events are dropped. A dropped code-change
// is answered with a resync, because the client waits for a reply before sending more.
export function limitEvents(socket, { roomService, logger, windowMs = 5000, maxEvents = 200 }) {
  let windowStartedAt = Date.now();
  let count = 0;
  let warned = false;

  socket.use(([event, payload], next) => {
    const now = Date.now();
    if (now - windowStartedAt > windowMs) {
      windowStartedAt = now;
      count = 0;
      warned = false;
    }

    count += 1;
    if (count <= maxEvents) {
      next();
      return;
    }

    if (!warned) {
      warned = true;
      logger.warn({ socketId: socket.id, event, maxEvents, windowMs }, 'Socket exceeded its event rate limit');
      socket.emit('server-error', { message: RATE_LIMITED_MESSAGE });
    }

    const room = event === 'code-change' && socket.data.roomId === payload?.roomId ? roomService.getRoom(socket.data.roomId) : undefined;
    if (room) socket.emit('force-resync', roomService.snapshot(room));
  });
}
