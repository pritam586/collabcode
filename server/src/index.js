import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socket/index.js';

const app = express();
const httpServer = createServer(app);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.disable('x-powered-by');
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(cors({ origin: clientOrigin }));
app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

const io = new Server(httpServer, {
  maxHttpBufferSize: 110_000,
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST'],
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
