# CollabCode

A focused real-time collaborative code editor built with React, Monaco Editor, Express, and Socket.io.

The **Run code** button executes JavaScript in a sandboxed browser frame and shows `console.log` output or runtime errors below the editor. The runner intentionally executes in the browser rather than on the Node server, so collaborators cannot run arbitrary processes on the host machine. Other language modes remain available for editing and highlighting.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

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

## Collaboration model

The server holds the authoritative document and monotonically increasing version. The client batches its unsent edits into one minimal prefix/suffix delta and waits for an acknowledgement before sending the next one. If a concurrent remote edit makes that delta unsafe to apply, the client requests a snapshot resync rather than risking corruption.

This is deliberately a small, teachable versioned-delta implementation. For production-grade simultaneous editing, replace this layer with a CRDT such as Yjs.

## Production notes

Rooms are public to anyone who knows their ID, document state is held in memory, and an empty room expires after 30 minutes. Deployments that need private, durable workspaces should add authentication/authorization, persistence, rate limiting at the edge, HTTPS, and a CRDT-based collaboration layer.
