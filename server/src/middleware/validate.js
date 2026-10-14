import { HttpError } from '../utils/httpError.js';

// Replaces request.body with the parsed value (unknown keys dropped, strings trimmed).
export function validateBody(schema) {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body ?? {});
    if (!result.success) {
      next(new HttpError(400, result.error.issues[0]?.message || 'The request is invalid.'));
      return;
    }
    request.body = result.data;
    next();
  };
}
