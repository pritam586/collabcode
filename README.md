# CollabCode

A real-time collaborative code editor. Create a room, share the link, and edit the same file together with live cursors, chat, a shared task list and a sandboxed code runner. No accounts, no installs.

<!-- Screenshots: add images to docs/screenshots/ and uncomment.
![Home page](docs/screenshots/home.png)
![Two people editing the same room](docs/screenshots/workspace.png)
![Phone layout with the bottom tab bar](docs/screenshots/mobile.png)
-->

> **Screenshots to add:** home page, a room with two people editing, the phone layout.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Quick start with Docker](#quick-start-with-docker)
- [Local development](#local-development)
- [Scripts](#scripts)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Security](#security)
- [Contributing](#contributing)

## Features

**Rooms and sharing**

- One click on the home page creates a room with a readable, hard-to-guess code such as `swift-otter-4821`.
- Share copies an invite link (`/r/<code>`). Anyone who opens it picks a display name and joins; there is no sign-up.
- Join from the home page with a code or a pasted link.
- Up to 10 people per room (configurable). Rooms nobody opens for 30 days are deleted.

**Editing together**

- A Monaco editor (the editor inside VS Code) shared through [Yjs](https://docs.yjs.dev), a CRDT. Simultaneous edits merge, so nobody's typing is overwritten or lost.
- Live cursors and selections with name tags, and "is typing" indicators.
- Undo and redo (Ctrl+Z / Ctrl+Y) only revert your own changes.
- Edits made while offline merge when the connection comes back. If the server ever loses recent changes, reconnecting clients send them back automatically.
- Nine editor languages: JavaScript, TypeScript, Python, Java, C++, JSON, CSS, HTML, Markdown.

**Running code**

- **Run** or Ctrl+Enter (Cmd+Enter on a Mac).
- JavaScript runs in your browser, inside a sandboxed iframe and web worker with a 3-second limit.
- Python, TypeScript, Java and C++ run on the server in a throwaway Docker container: no network, 256 MB memory, 1 CPU, read-only file system, 2-minute limit.

**Around the code**

- Chat that is saved with the room, with timestamps, emoji and retry for messages that failed to send.
- A shared task list you can add to, tick off, edit and delete. It syncs and works offline like the code.
- A People list with cursor colors and typing state.

**Interface**

- Light, dark or system theme, with your choice saved.
- Adjustable font size and keyboard shortcuts (press `?`).
- Toasts for anything that needs attention, and friendly error pages.
- A short first-visit tour.
- **Responsive:**
  - Phones get a bottom tab bar (Code, Output, Chat, Tasks, People), 44 px touch targets and a symbol bar above the keyboard.
  - Tablets get a drawer sidebar; desktops get a side-by-side sidebar.
- **Accessible:**
  - Labelled controls, keyboard-navigable tabs and dialogs, visible focus, and live regions.
  - Every text and UI color pair is checked against WCAG AA in both themes.

## Tech stack

| Layer       | Technology                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| Client      | React 18, Vite 6, Monaco Editor (bundled, no CDN), Yjs, Socket.io client, lucide-react icons            |
| Server      | Node.js 22.13+, Express 4, Socket.io 4, Yjs and y-protocols, zod, helmet, pino                          |
| Storage     | SQLite through Node's built-in `node:sqlite`, with migrations                                           |
| Code runner | Docker CLI, one locked-down container per run                                                           |
| Quality     | ESLint 9 (React, Hooks, jsx-a11y), Prettier, Vitest and Testing Library, Node's test runner, Playwright |
| Delivery    | Docker, nginx (unprivileged), Docker Compose, GitHub Actions                                            |

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI["React app<br/>(landing page, workspace)"]
    Editor["Monaco editor"]
    Provider["SocketYjsProvider<br/>Y.Doc: code + tasks<br/>awareness: cursors, typing"]
    Sandbox["Sandboxed iframe + worker<br/>(runs JavaScript)"]
    UI --> Editor
    Editor <--> Provider
    UI --> Sandbox
  end

  subgraph nginx["web: nginx"]
    Static["Static files<br/>SPA fallback, CSP"]
    Proxy["Reverse proxy<br/>/api, /health, /socket.io"]
  end

  subgraph Server["server: Node.js"]
    HTTP["Express<br/>helmet, zod, rate limits<br/>POST /api/run, GET /health"]
    Sockets["Socket.io<br/>rooms, Yjs sync, awareness,<br/>chat, language"]
    Rooms["Room service<br/>live Y.Docs, save every 2 s,<br/>expiry and retention"]
    Runner["Code runner"]
    HTTP --> Runner
    Sockets --> Rooms
  end

  DB[("SQLite<br/>rooms, chat_messages")]
  Containers["Docker containers<br/>Python, TypeScript, Java, C++"]

  UI -- "HTTPS" --> Static
  Provider -- "WebSocket" --> Proxy
  UI -- "fetch /api/run" --> Proxy
  Proxy --> HTTP
  Proxy --> Sockets
  Rooms --> DB
  Runner --> Containers
```

**How a join works.** The client sends `join-room` and gets the room's language, participants and recent chat. The server and client then exchange Yjs state vectors and each sends the other what it is missing, which is also how offline edits and edits lost in a crash are recovered. After that, every keystroke is a small Yjs update the server applies and relays. Cursors and typing flags travel as Yjs awareness updates; the server overwrites each person's name and color with its own record, so nobody can pose as someone else.

The full HTTP API, socket events, persistence rules and notes on running several server instances are in [docs/api.md](docs/api.md).

## Quick start with Docker

Requirements: Docker with Compose v2.

```bash
docker compose up --build
```

Open <http://localhost:8080>. Room data lives in the `collabcode-data` volume.

This runs JavaScript in the browser only. To run Python, TypeScript, Java and C++ as well, read the warning in [`docker-compose.runner.yml`](docker-compose.runner.yml) and start with both files:

```bash
docker compose -f docker-compose.yml -f docker-compose.runner.yml up --build
```

## Local development

Requirements:

- Node.js 22.13 or newer and npm 10 or newer.
- Docker Desktop, running, if you want the server to run Python, TypeScript, Java and C++. Without it the output panel says Docker is not running, and everything else works.

Install everything once:

```bash
npm run install:all
```

Start the server and the client in two terminals:

```bash
npm --prefix server run dev
```

```bash
npm --prefix client run dev
```

Open the URL Vite prints (usually <http://localhost:5173>) and create a room. Open the invite link in a second browser window to collaborate with yourself.

## Scripts

| Where  | Command                             | What it does                                                         |
| ------ | ----------------------------------- | -------------------------------------------------------------------- |
| root   | `npm run install:all`               | Installs root, server and client dependencies                        |
| root   | `npm run lint`                      | ESLint over the whole repository (no warnings allowed)               |
| root   | `npm run format` / `format:check`   | Prettier write / check                                               |
| root   | `npm test`                          | Server and client unit and integration tests                         |
| root   | `npm run test:e2e`                  | Playwright end-to-end tests (builds the client, starts both servers) |
| root   | `npm run check`                     | Lint, format check, tests and contrast check, as CI runs them        |
| server | `npm run dev` / `npm start`         | Start with file watching / without                                   |
| server | `npm test`                          | Unit tests plus HTTP and Socket.io integration tests                 |
| client | `npm run dev` / `build` / `preview` | Vite dev server / production build / serve the build                 |
| client | `npm test`                          | Vitest unit and component tests                                      |
| client | `npm run check:contrast`            | WCAG AA contrast check of the design tokens                          |

## Configuration

The server reads environment variables (or `server/.env`; copy [`server/.env.example`](server/.env.example)). Every value is checked at start-up, and a bad value stops the server with a message that names it.

| Variable                                                                                  | Default                              | Meaning                                                                                                               |
| ----------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                                                                    | `4000`                               | HTTP and WebSocket port                                                                                               |
| `NODE_ENV`                                                                                | `development`                        | `development`, `production` or `test`                                                                                 |
| `CLIENT_ORIGIN`                                                                           | `http://localhost:5173`              | Comma-separated browser origins allowed to connect. Outside production any `http://localhost:<port>` is also allowed. |
| `TRUST_PROXY`                                                                             | off                                  | Set behind a reverse proxy (`1`, `true` or a subnet list) so rate limits see real client IPs                          |
| `LOG_LEVEL`                                                                               | `info`                               | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`                                                        |
| `LOG_FORMAT`                                                                              | `pretty` in development, else `json` | Log output format                                                                                                     |
| `DATABASE_PATH`                                                                           | `data/collabcode.db`                 | SQLite file; created on first start                                                                                   |
| `MAX_PARTICIPANTS_PER_ROOM`                                                               | `10`                                 | Join limit per room (1–100)                                                                                           |
| `EMPTY_ROOM_TTL_MINUTES`                                                                  | `30`                                 | How long an empty room stays in memory (it stays in the database)                                                     |
| `ROOM_RETENTION_DAYS`                                                                     | `30`                                 | Stored rooms nobody opens for this long are deleted                                                                   |
| `CODE_RUNNER_ENABLED`                                                                     | `true`                               | `false` turns off the Docker runner                                                                                   |
| `DOCKER_BIN`                                                                              | `docker`                             | Docker CLI to use                                                                                                     |
| `RUNNER_WORK_DIR`                                                                         | OS temp dir                          | Where programs are written before being mounted into a run container                                                  |
| `JAVA_RUNNER_IMAGE`, `CPP_RUNNER_IMAGE`, `PYTHON_RUNNER_IMAGE`, `TYPESCRIPT_RUNNER_IMAGE` | see `.env.example`                   | Runner images, if you need approved or internal ones                                                                  |

The client reads one variable at build time (see [`client/.env.example`](client/.env.example)):

| Variable          | Default                 | Meaning                                                                                                                                       |
| ----------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SERVER_URL` | `http://localhost:4000` | Server address. `same-origin` means "the origin the page was loaded from", for setups where a reverse proxy forwards `/api` and `/socket.io`. |

Docker Compose also reads `PUBLIC_URL` (default `http://localhost:8080`), `WEB_PORT` (default `8080`), `LOG_LEVEL`, `MAX_PARTICIPANTS_PER_ROOM` and `ROOM_RETENTION_DAYS`.

## Testing

| Suite                                          | Command                                  | What it covers                                                                                                                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server unit and integration (Node test runner) | `npm --prefix server test`               | Config, schemas, rate limits, repositories, migrations, room service, awareness filtering, HTTP API, and every socket event against a real server with headless Yjs clients: concurrent edits, offline merges, restarts, size limits, chat, throttling |
| Client unit and component (Vitest)             | `npm --prefix client test`               | Room codes, storage, the Yjs provider, task and presence hooks, tabs, chat, landing page, tasks panel, toasts                                                                                                                                          |
| End-to-end (Playwright)                        | `npm run test:e2e`                       | Two browsers creating, joining, editing, chatting and sharing tasks in one room; running JavaScript; reload persistence; error pages; phone layout and 44 px targets                                                                                   |
| Accessibility colors                           | `npm --prefix client run check:contrast` | 62 color pairs in both themes                                                                                                                                                                                                                          |

Playwright uses your installed Chrome locally. In CI it downloads its own Chromium.

To audit performance and accessibility with Lighthouse:

```bash
npm --prefix client run build
npm --prefix client run preview -- --port 4173
npx lighthouse@13.5.0 http://localhost:4173/ --view
```

The last audit (mobile, throttled) scored 100 for performance, accessibility, best practices and SEO on the home page. Room links score lower for SEO on purpose: `robots.txt` keeps them out of search engines.

## Deployment

The Compose setup is a complete single-machine deployment:

- **`web`**: nginx serves the built app and proxies `/api`, `/health` and `/socket.io` to the server.
  - Unknown paths fall back to `index.html`, so `/r/<code>` links work.
  - Hashed assets are cached for a year, and responses are gzipped.
  - Each page gets a strict Content-Security-Policy with a per-request nonce.
- **`server`**: runs as a non-root user with a health check and a data volume.
  - On `docker compose stop` it saves every room before exiting.

To put it on the internet:

1. **Add TLS.** Terminate HTTPS in front of `web`, for example with Caddy, Traefik or a cloud load balancer. Forward WebSocket upgrades.
2. **Set `PUBLIC_URL`.** Use the address people will open, such as `https://collab.example.com`, so the server accepts their connections.
3. **Back up the `collabcode-data` volume.** It holds the SQLite database. SQLite runs in WAL mode, so back up all three `collabcode.db*` files together, or use `sqlite3 .backup`.
4. **Decide about the code runner.** Enabling it means mounting the Docker socket (see `docker-compose.runner.yml`), so only do that on a dedicated machine.

Deploying without Docker:

- Build the client with `VITE_SERVER_URL` set, and serve `client/dist` with an SPA fallback.
- Run the server with `NODE_ENV=production`, `CLIENT_ORIGIN` and `TRUST_PROXY`.
- Reuse `client/nginx/` as a starting point for the web server config.

Running more than one server instance needs a shared database and shared document updates. See [docs/api.md](docs/api.md#running-more-than-one-server-instance).

## Project structure

```
.
├── client/                 React app (Vite)
│   ├── src/
│   │   ├── collab/         Yjs provider, Monaco binding, remote cursors
│   │   ├── components/     Screens and panels; ui/ holds the design-system components
│   │   ├── editor/         Bundled Monaco setup
│   │   ├── hooks/          Room session, collaboration, preferences, media queries
│   │   ├── lib/            Room codes, storage, server URL, platform helpers
│   │   └── styles/         tokens.css, base.css, components.css, app.css
│   ├── nginx/              Production web server config (CSP, proxy, caching)
│   └── scripts/            check-contrast.mjs
├── server/
│   ├── src/
│   │   ├── config/         Validated environment config, limits, origins
│   │   ├── controllers/    HTTP handlers
│   │   ├── db/             SQLite connection and migrations
│   │   ├── middleware/     Errors, rate limiting, body validation
│   │   ├── models/         SQL for rooms and chat
│   │   ├── routes/         HTTP routes
│   │   ├── services/       Room service, awareness filter, code runner
│   │   ├── socket/         Socket.io handlers (rooms, Yjs, chat, language, limits)
│   │   └── validation/     zod schemas for every payload
│   └── test/               Node test runner suites
├── e2e/                    Playwright tests
├── docs/api.md             HTTP API, socket events, persistence, scaling
├── docker-compose.yml      Production-style local deployment
└── .github/workflows/ci.yml
```

## Security

- **Input validation.** Every HTTP body and socket payload is validated with zod. Unknown fields are dropped, and display names and chat cannot contain control or bidi-override characters.
- **Rate limits and identity.**
  - Rate limits apply to `/api`, code runs, socket events (count and bytes) and chat.
  - WebSocket connections from foreign origins are refused.
  - Cursor names and colors come from the server.
- **Headers.** helmet on the API, and a nonce-based CSP, `nosniff`, no referrer and `frame-ancestors 'none'` on the web app.
- **Code runs.**
  - Native runs use a locked-down container per run.
  - JavaScript runs in a sandboxed iframe with no access to the app.
- **Rooms.** Rooms are public to anyone with the link; there are no accounts. Treat invite links like passwords.

## Contributing

Run `npm run check` before opening a pull request; CI runs the same checks plus the end-to-end tests and a Docker build. The repository has no license file yet.
