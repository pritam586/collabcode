export const SERVER_ERROR_MESSAGE = 'Something went wrong on the server. Please try again.';

// Returns an `on(event, schema, handler, { onInvalid })` helper for one socket. Payloads that
// fail the schema never reach the handler, and a handler that throws is logged and answered
// with a generic `server-error` event instead of crashing the process or leaking details.
export function createEventHandler(socket, logger) {
  return function on(event, schema, handler, { onInvalid } = {}) {
    socket.on(event, async (payload) => {
      const result = schema.safeParse(payload ?? {});
      if (!result.success) {
        logger.debug({ event, socketId: socket.id, issues: result.error.issues }, 'Rejected socket payload');
        onInvalid?.(result.error);
        return;
      }

      try {
        await handler(result.data);
      } catch (error) {
        logger.error({ err: error, event, socketId: socket.id }, 'Socket handler failed');
        socket.emit('server-error', { message: SERVER_ERROR_MESSAGE });
      }
    });
  };
}
