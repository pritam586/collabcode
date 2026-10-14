import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socket/index.js';
import { registerRunRoute } from './routes/runRoute.js';
import { createOriginMatcher } from './config/origins.js';

const app = express();
const httpServer = createServer(app);
const isAllowedOrigin = createOriginMatcher({ clientOrigin: process.env.CLIENT_ORIGIN, nodeEnv: process.env.NODE_ENV });
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
registerRunRoute(app);

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

const port = Number(process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}
httpServer.listen(port, () => {
  console.log(`CollabCode server listening on http://localhost:${port}`);
});
