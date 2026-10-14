import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socket/index.js';
import { registerRunRoute } from './routes/runRoute.js';
import { loadConfig } from './config/env.js';
import { createOriginMatcher } from './config/origins.js';
import { createCodeRunner } from './services/codeRunner.js';
import { createLogger } from './utils/logger.js';

const config = loadConfig();
const logger = createLogger(config.log);
const app = express();
const httpServer = createServer(app);
const isAllowedOrigin = createOriginMatcher({ clientOrigin: config.clientOrigin, nodeEnv: config.env });
// Requests without an Origin header (curl, health checks) are not browser cross-origin requests.
const corsOrigin = (origin, callback) => callback(null, !origin || isAllowedOrigin(origin));

app.disable('x-powered-by');
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '110kb' }));
app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});
registerRunRoute(app, createCodeRunner(config.runner));

const io = new Server(httpServer, {
  maxHttpBufferSize: 110_000,
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
  // CORS does not apply to WebSocket upgrades, so check the browser origin explicitly.
  allowRequest: (request, callback) => {
    const { origin } = request.headers;
    callback(null, !origin || isAllowedOrigin(origin));
  },
});

registerSocketHandlers(io);

httpServer.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, `CollabCode server listening on http://localhost:${config.port}`);
});
