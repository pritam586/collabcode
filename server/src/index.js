import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socket/index.js';

const app = express();
const httpServer = createServer(app);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: clientOrigin }));
app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

const io = new Server(httpServer, {
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST'],
  },
});

registerSocketHandlers(io);

const port = Number(process.env.PORT || 4000);
httpServer.listen(port, () => {
  console.log(`CollabCode server listening on http://localhost:${port}`);
});
