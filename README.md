# CollabCode

A focused real-time collaborative code editor built with React, Monaco Editor, Express, and Socket.io.

The **Run code** button (or **Ctrl+Enter** / **Cmd+Enter**) executes JavaScript in a sandboxed browser frame and shows `console.log` output or runtime errors below the editor. Java, C++, Python, and TypeScript execute in a resource-limited Docker container with network access disabled. JSON, CSS, HTML, and Markdown are available for editing and highlighting only.

## Requirements

- Node.js 22.13 or newer (the server uses the built-in `node:sqlite` module)
- npm 10 or newer
- Docker Desktop, running locally, for Java, C++, Python, and TypeScript execution

Install Docker Desktop from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) and start it. The first run in each language downloads its runner image, so it takes longer. If Docker Desktop is not running, the output panel says so. Java code runs the first `public class` it finds (defaulting to `Main`); C++ code needs a standard `int main()` entry point.

## Run locally

Open two terminals:

```powershell
cd server
npm install
npm run dev
```

```powershell
cd client
npm install
npm run dev
```

Then open the client URL in two browser windows. Enter the same room name in both and start editing.

Run the server tests (unit plus HTTP and Socket.io integration tests) with:

```powershell
cd server
npm test
```

## Environment

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env` if you need to override the local defaults.

All server settings are validated at start-up; see `server/.env.example` for every option and its default.

`CLIENT_ORIGIN` accepts a comma-separated list of browser origins. Outside production (`NODE_ENV` is not `production`) any `http://localhost:<port>` origin is also accepted, so the client keeps working if Vite picks a port other than 5173. In production, list every origin that should be able to connect.

## Collaboration model

The server holds the authoritative document and monotonically increasing version. The client batches its unsent edits into one minimal prefix/suffix delta and waits for an acknowledgement before sending the next one. If a concurrent remote edit makes that delta unsafe to apply, the client requests a snapshot resync rather than risking corruption.

This is deliberately a small, teachable versioned-delta implementation. For production-grade simultaneous editing, replace this layer with a CRDT such as Yjs.

## Server layout

```
server/src/
  index.js        start-up and graceful shutdown
  server.js       builds the HTTP + Socket.io server
  app.js          Express middleware (helmet, CORS, logging, errors)
  config/         validated environment config, limits, allowed origins
  routes/         HTTP routes
  controllers/    HTTP request handlers
  middleware/     error handler, rate limiting, body validation
  socket/         Socket.io event handlers and event rate limiting
  services/       room service (live state + persistence), code runner
  models/         SQL for each table
  db/             SQLite connection and migrations
  validation/     zod schemas for every HTTP body and socket payload
  utils/          logger, errors, text deltas, colors
```

[docs/api.md](docs/api.md) documents the HTTP API, socket events, persistence rules, and what running more than one server instance would take.

## Production notes

Rooms are public to anyone who knows their ID. Room content is stored in SQLite and survives restarts; a crash can lose up to about 2 seconds of edits, which reconnecting clients restore from their editors. Set `NODE_ENV=production`, list your client origins in `CLIENT_ORIGIN`, set `TRUST_PROXY` behind a reverse proxy, and serve over HTTPS. Running more than one server instance needs extra work; see [docs/api.md](docs/api.md#running-more-than-one-server-instance).
