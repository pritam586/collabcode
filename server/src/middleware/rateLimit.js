import { HttpError } from '../utils/httpError.js';
import { createRateLimiter } from '../utils/rateLimiter.js';

export function rateLimit({ windowMs, maxRequests, message }) {
  const limiter = createRateLimiter({ windowMs, maxRequests });
  return (request, response, next) => {
    const address = request.ip || request.socket.remoteAddress || 'unknown';
    if (limiter.allow(address)) {
      next();
      return;
    }
    response.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
    next(new HttpError(429, message));
  };
}
