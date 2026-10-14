import { HttpError } from '../utils/httpError.js';

export function notFoundHandler(request, response) {
  response.status(404).json({ error: 'Not found.', requestId: request.id });
}

// Central error middleware: clients get a short, friendly message and a request id to quote;
// stack traces and internal details only go to the log.
export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  const { status, message } = describeError(error);
  // pino-http logs the finished response; attaching the error includes its stack in that entry.
  if (status >= 500) response.err = error;
  response.status(status).json({ error: message, requestId: request.id });
}

function describeError(error) {
  if (error instanceof HttpError) return { status: error.status, message: error.message };
  if (error?.type === 'entity.too.large') return { status: 413, message: 'The request is too large.' };
  if (error?.type === 'entity.parse.failed') return { status: 400, message: 'The request body must be valid JSON.' };
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    return { status: error.status, message: 'The request could not be processed.' };
  }
  return { status: 500, message: 'Something went wrong on the server. Please try again.' };
}
