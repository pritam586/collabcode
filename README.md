# CollabCode

A focused real-time collaborative code editor built with React, Monaco Editor, Express, and Socket.io.

**Create a room** in one click on the home page and share the link (for example `/r/swift-otter-4821`). Anyone who opens it picks a display name and joins; there are no accounts. Inside a room you get:

- A shared Monaco editor with live cursors, name tags and "is typing" indicators.
- A toolbar with language, **Run** (Ctrl+Enter / Cmd+Enter), output panel, font size, light/dark/system theme, keyboard shortcuts (press `?`), and the sidebar toggle.
- A collapsible sidebar with **People**, **Chat** (kept with the room) and a shared **Tasks** list.
- A short first-visit tour, toasts for anything that needs your attention, and friendly error pages.

The **Run** button executes JavaScript in a sandboxed browser frame and shows `console.log` output or runtime errors below the editor. Java, C++, Python, and TypeScript execute in a resource-limited Docker container with network access disabled. JSON, CSS, HTML, and Markdown are available for editing and highlighting only.

The interface is built from design tokens (`client/src/styles/tokens.css`) and a small set of accessible components (`client/src/components/ui/`). `npm run check:contrast` in `client/` verifies every text and UI color pair against WCAG AA in both themes.

Room links are paths like `/r/<code>`, so a production web server must serve `index.html` for them (Vite's dev and preview servers already do).

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

Each room is a [Yjs](https://docs.yjs.dev) document, a CRDT, so simultaneous edits from everyone merge automatically and every editor ends up with the same text. Yjs messages travel over the app's existing Socket.io connection (`client/src/collab/SocketYjsProvider.js`, `server/src/socket/yjsHandlers.js`).

- **Offline edits** stay in the browser's copy of the document and merge when the connection comes back.
- **Server restarts** are covered by SQLite. If the server ever loses recent edits, reconnecting clients send them back during the sync handshake.
- **Cursors and selections** use Yjs awareness. Names and colors are set by the server, so a client cannot pose as someone else.
- **Ctrl+Z / Ctrl+Y** undo and redo only your own changes, never a collaborator's.

Monaco is bound to the shared text by `client/src/collab/monacoBinding.js`, a small equivalent of `y-monaco`. The app loads Monaco through `@monaco-editor/react`, and `y-monaco` would bundle a second copy.

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
  services/       room service (Yjs documents, awareness, persistence), code runner
  models/         SQL for each table
  db/             SQLite connection and migrations
  validation/     zod schemas for every HTTP body and socket payload
  utils/          logger, errors, rate limiter, colors
```

[docs/api.md](docs/api.md) documents the HTTP API, socket events, persistence rules, and what running more than one server instance would take.

## Production notes

Rooms are public to anyone who knows their ID. Room content is stored in SQLite and survives restarts; a crash can lose up to about 2 seconds of edits, which reconnecting clients send back automatically. Set `NODE_ENV=production`, list your client origins in `CLIENT_ORIGIN`, set `TRUST_PROXY` behind a reverse proxy, and serve over HTTPS. Running more than one server instance needs extra work; see [docs/api.md](docs/api.md#running-more-than-one-server-instance).
