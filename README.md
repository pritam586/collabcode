# CollabCode

A focused real-time collaborative code editor built with React, Monaco Editor, Express, and Socket.io.

The **Run code** button (or **Ctrl+Enter** / **Cmd+Enter**) executes JavaScript in a sandboxed browser frame and shows `console.log` output or runtime errors below the editor. Java, C++, Python, and TypeScript execute in a resource-limited Docker container with network access disabled. JSON, CSS, HTML, and Markdown are available for editing and highlighting only.

## Requirements

- Node.js 20 or newer
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

## Environment

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env` if you need to override the local defaults.

`CLIENT_ORIGIN` accepts a comma-separated list of browser origins. Outside production (`NODE_ENV` is not `production`) any `http://localhost:<port>` origin is also accepted, so the client keeps working if Vite picks a port other than 5173. In production, list every origin that should be able to connect.

## Collaboration model

The server holds the authoritative document and monotonically increasing version. The client batches its unsent edits into one minimal prefix/suffix delta and waits for an acknowledgement before sending the next one. If a concurrent remote edit makes that delta unsafe to apply, the client requests a snapshot resync rather than risking corruption.

This is deliberately a small, teachable versioned-delta implementation. For production-grade simultaneous editing, replace this layer with a CRDT such as Yjs.

## Production notes

Rooms are public to anyone who knows their ID, document state is held in memory, and an empty room expires after 30 minutes. If the server restarts, the first participant to reconnect restores the room from their editor. Deployments that need private, durable workspaces should add authentication/authorization, persistence, rate limiting at the edge, HTTPS, and a CRDT-based collaboration layer.
