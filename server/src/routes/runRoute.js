import { CodeRunnerError, runCompiledCode } from '../services/codeRunner.js';

const REQUEST_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestCounts = new Map();

export function registerRunRoute(app) {
  app.post('/api/run', async (request, response) => {
    const address = request.ip || request.socket.remoteAddress || 'unknown';
    if (!canRun(address)) {
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

function canRun(address, now = Date.now()) {
  const activeRequest = requestCounts.get(address);
  if (!activeRequest || now - activeRequest.startedAt > REQUEST_WINDOW_MS) {
    requestCounts.set(address, { startedAt: now, count: 1 });
    return true;
  }
  if (activeRequest.count >= MAX_REQUESTS_PER_WINDOW) return false;
  activeRequest.count += 1;
  return true;
}
