import 'dotenv/config';
import { loadConfig } from './config/env.js';
import { startServer } from './server.js';
import { createLogger } from './utils/logger.js';

const config = loadConfig();
const logger = createLogger(config.log);

const server = await startServer({ config, logger });
logger.info({ port: server.port, env: config.env }, `CollabCode server listening on http://localhost:${server.port}`);
