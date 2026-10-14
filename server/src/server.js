import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createOriginMatcher, toCorsOrigin } from './config/origins.js';
import { createCodeRunner } from './services/codeRunner.js';
import { createSocketServer } from './socket/index.js';

// Builds and starts the HTTP + Socket.io server. Tests call this with port 0 and their own
// config; src/index.js calls it with the environment's config.
export async function startServer({ config, logger, runCode = createCodeRunner(config.runner) }) {
  const isAllowedOrigin = createOriginMatcher({ clientOrigin: config.clientOrigin, nodeEnv: config.env });
  const corsOrigin = toCorsOrigin(isAllowedOrigin);

  const app = createApp({ config, logger, corsOrigin, runCode, healthChecks: {} });
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer, { corsOrigin, isAllowedOrigin });

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(config.port, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  return {
    httpServer,
    io,
    port: httpServer.address().port,
    async close() {
      // io.close() disconnects every socket and closes the underlying HTTP server.
      await new Promise((resolve) => io.close(() => resolve()));
    },
  };
}
