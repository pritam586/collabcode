import { loadConfig } from '../src/config/env.js';
import { startServer } from '../src/server.js';
import { createLogger } from '../src/utils/logger.js';

export const silentLogger = createLogger({ level: 'silent' });

export async function startTestServer({ env = {}, ...overrides } = {}) {
  const config = loadConfig({ NODE_ENV: 'test', PORT: '0', LOG_LEVEL: 'silent', ...env });
  const server = await startServer({ config, logger: silentLogger, ...overrides });
  return { ...server, config, url: `http://127.0.0.1:${server.port}` };
}
