import { languageChangeSchema } from '../validation/schemas.js';
import { createEventHandler } from './createEventHandler.js';

export function registerLanguageHandlers(io, socket, { roomService, logger }) {
  const on = createEventHandler(socket, logger);

  on('language-change', languageChangeSchema, ({ roomId, language }) => {
    // A socket may only act on the room it has joined.
    if (socket.data.roomId !== roomId || !roomService.setLanguage(roomId, language)) return;
    socket.to(roomId).emit('language-changed', { language });
  });
}
