# CollabCode

A focused real-time collaborative code editor built with React, Monaco Editor, Express, and Socket.io.

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
