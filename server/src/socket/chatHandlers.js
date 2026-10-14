import { createRateLimiter } from '../utils/rateLimiter.js';
import { CHAT_MESSAGE_ERROR, chatSendSchema } from '../validation/schemas.js';
import { createEventHandler } from './createEventHandler.js';

const TOO_FAST_MESSAGE = 'You are sending messages too quickly. Wait a few seconds and try again.';
const NOT_SENT_MESSAGE = 'Your message could not be sent. Try again.';

export function registerChatHandlers(io, socket, { roomService, logger }) {
  const on = createEventHandler(socket, logger);
  const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 10 });

  on('chat-send', chatSendSchema, ({ roomId, body, clientId }) => {
    if (socket.data.roomId !== roomId) return;
    if (!limiter.allow(socket.id)) {
      socket.emit('chat-error', { message: TOO_FAST_MESSAGE, clientId });
      return;
    }

    const message = roomService.postMessage(roomId, socket.id, body);
    if (!message) {
      socket.emit('chat-error', { message: NOT_SENT_MESSAGE, clientId });
      return;
    }
    // Everyone, including the sender, gets the stored copy with its id and server timestamp.
    io.to(roomId).emit('chat-message', { ...message, clientId });
  }, {
    onInvalid: (error) => socket.emit('chat-error', { message: error.issues[0]?.message || CHAT_MESSAGE_ERROR }),
  });
}
