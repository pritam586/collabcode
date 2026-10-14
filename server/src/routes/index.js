import express from 'express';
import { rateLimit } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { runRequestSchema } from '../validation/schemas.js';

export function createRoutes({ controllers }) {
  const router = express.Router();

  router.get('/health', controllers.health.show);

  router.use('/api', rateLimit({ windowMs: 60_000, maxRequests: 120, message: 'Too many requests. Try again in a minute.' }));
  router.post(
    '/api/run',
    rateLimit({ windowMs: 60_000, maxRequests: 10, message: 'Too many run requests. Try again in a minute.' }),
    validateBody(runRequestSchema),
    controllers.run.run,
  );

  return router;
}
