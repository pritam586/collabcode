import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createOriginMatcher, toCorsOrigin } from './config/origins.js';
import { openDatabase } from './db/database.js';
import { createRoomRepository } from './models/roomRepository.js';
import { createCodeRunner } from './services/codeRunner.js';
import { createRoomService } from './services/roomService.js';
import { createSocketServer } from './socket/index.js';

// Builds and starts the HTTP + Socket.io server. Tests call this with port 0 and their own
// config; src/index.js calls it with the environment's config.
export async function startServer({ config, logger, runCode = createCodeRunner(config.runner) }) {
  const isAllowedOrigin = createOriginMatcher({ clientOrigin: config.clientOrigin, nodeEnv: config.env });
  const corsOrigin = toCorsOrigin(isAllowedOrigin);

  const db = openDatabase(config.databasePath, { logger });
  const roomService = createRoomService({
    repository: createRoomRepository(db),
    logger,
    maxParticipants: config.rooms.maxParticipants,
    emptyRoomTtlMs: config.rooms.emptyRoomTtlMs,
    retentionMs: config.rooms.retentionMs,
  });
  roomService.start();

  const healthChecks = {
    database: () => {
      db.prepare('SELECT 1').get();
      return 'ok';
    },
    rooms: () => roomService.stats(),
  };

  const app = createApp({ config, logger, corsOrigin, runCode, healthChecks });
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer, { corsOrigin, isAllowedOrigin, roomService, logger });

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
    roomService,
    port: httpServer.address().port,
    async close() {
      // io.close() disconnects every socket and closes the underlying HTTP server; rooms are
      // saved after that so no edit can arrive between the final flush and closing the database.
      await new Promise((resolve) => io.close(() => resolve()));
      roomService.close();
      db.close();
    },
  };
}
