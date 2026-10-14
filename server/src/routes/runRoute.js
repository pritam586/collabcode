import { CodeRunnerError, runCompiledCode } from '../services/codeRunner.js';
import { createRateLimiter } from '../utils/rateLimiter.js';

const runLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });

export function registerRunRoute(app) {
  app.post('/api/run', async (request, response) => {
    const address = request.ip || request.socket.remoteAddress || 'unknown';
    if (!runLimiter.allow(address)) {
      response.status(429).json({ error: 'Too many run requests. Try again in a minute.' });
      return;
    }

    try {
      const result = await runCompiledCode(request.body?.language, request.body?.code);
      response.status(200).json(result);
    } catch (error) {
      const status = error instanceof CodeRunnerError ? error.status : 500;
      response.status(status).json({ error: error instanceof CodeRunnerError ? error.message : 'The code runner failed unexpectedly.' });
    }
  });
}
