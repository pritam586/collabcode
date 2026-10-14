import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { createHealthController } from './controllers/healthController.js';
import { createRunController } from './controllers/runController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRoutes } from './routes/index.js';

export function createApp({ config, logger, corsOrigin, runCode, healthChecks }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(pinoHttp({
    logger,
    genReqId: (_request, response) => {
      const id = randomUUID();
      response.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel: (_request, response, error) => {
      if (error || response.statusCode >= 500) return 'error';
      return response.statusCode >= 400 ? 'warn' : 'info';
    },
    serializers: {
      req: (request) => ({ id: request.id, method: request.method, url: request.url }),
      res: (response) => ({ statusCode: response.statusCode }),
    },
    autoLogging: { ignore: (request) => request.url === '/health' },
  }));
  // The server only returns JSON, so helmet's strict defaults (CSP, CORP, HSTS, nosniff) all apply.
  app.use(helmet({ frameguard: { action: 'deny' } }));
  app.use(cors({ origin: corsOrigin, exposedHeaders: ['X-Request-Id'] }));
  app.use(express.json({ limit: '110kb' }));

  app.use(createRoutes({
    controllers: {
      health: createHealthController({ checks: healthChecks }),
      run: createRunController({ runCode }),
    },
  }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
