import 'dotenv/config';
import { loadConfig } from './config/env.js';
import { startServer } from './server.js';
import { createLogger } from './utils/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const config = loadConfig();
const logger = createLogger(config.log);

let server;
try {
  server = await startServer({ config, logger });
} catch (error) {
  logger.fatal({ err: error }, 'CollabCode server failed to start');
  process.exit(1);
}
logger.info({ port: server.port, env: config.env }, `CollabCode server listening on http://localhost:${server.port}`);

let shuttingDown = false;
// Stops accepting connections, disconnects sockets, saves every unsaved room, then exits.
// A long-running request (such as a code run) cannot hold the process open past the timeout.
async function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ reason }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Shutdown timed out; exiting anyway');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await server.close();
    logger.info('Shutdown complete');
  } catch (error) {
    logger.error({ err: error }, 'Error during shutdown');
    exitCode = 1;
  }
  clearTimeout(forceExit);
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  shutdown('uncaughtException', 1);
});
