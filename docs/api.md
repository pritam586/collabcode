# CollabCode server API

The server exposes a small JSON HTTP API and a Socket.io connection for real-time
collaboration. Every payload is validated with zod (`server/src/validation/schemas.js`):
unknown fields are dropped, and invalid payloads are rejected as described below.

## HTTP

All responses are JSON. Every response carries an `X-Request-Id` header. Error responses
have the shape `{ "error": string, "requestId": string }`; `error` is always safe to show
to users and never contains stack traces.

Requests under `/api` are limited to 120 per minute per client address. A `429` response
includes a `Retry-After` header in seconds.

### `GET /health`

Liveness and readiness check. Not rate limited and not request-logged.

| Status | Body |
| --- | --- |
| 200 | `{ "status": "ok", "uptimeSeconds": 42, "checks": { "database": "ok", "rooms": { "openRooms": 1, "participants": 2, "unsavedRooms": 0 } } }` |
| 503 | Same shape with `"status": "degraded"` and the failing check set to `"unavailable"` |

### `POST /api/run`

Runs Java, C++, Python or TypeScript in a locked-down Docker container (no network,
256 MB memory, 1 CPU, 64 processes, read-only filesystem, 120 s timeout). JavaScript runs
in the browser and never reaches this endpoint. Limited to 10 runs per minute per address.

Request body:

```json
{ "language": "java" | "cpp" | "python" | "typescript", "code": "string, 1-25000 characters" }
```

| Status | Meaning |
| --- | --- |
| 200 | `{ "stdout": string, "stderr": string, "exitCode": number }`. Output is truncated to 16,000 characters per stream. A non-zero `exitCode` means the program failed, not the request. |
| 400 | Invalid body: unsupported language, empty or oversized code, or malformed JSON |
| 408 | The program ran longer than 120 seconds |
| 413 | Request body larger than 110 KB |
| 429 | Rate limit reached |
| 503 | Runner disabled (`CODE_RUNNER_ENABLED=false`), Docker Desktop not running, or the runner container could not start |

## Socket.io

Connect with the WebSocket transport. Connections from browser origins not allowed by
`CLIENT_ORIGIN` are refused during the handshake. Each connection may send 200 events per
5 seconds; extra events are dropped, with one `server-error` per window.

A socket is in at most one room at a time and may only act on the room it joined. Events
naming another room are ignored.

The shared document is a [Yjs](https://docs.yjs.dev) document with one `Y.Text` named
`content`. Document and cursor changes travel as binary
[y-protocols](https://github.com/yjs/y-protocols) messages inside two events, `yjs-sync` and
`yjs-awareness`. Both payloads are `{ roomId, data }`, where `data` is a `Uint8Array` of at
most 1,000,000 bytes. Edits from different people merge automatically, including edits made
while offline, so there are no version numbers, acknowledgements or resyncs to handle.

```ts
type Participant = { socketId: string; name: string; color: 'violet' | 'cyan' | 'amber' | 'rose' | 'lime' | 'sky' };
type ChatMessage = { id: number; author: { name: string; color: string; socketId?: string }; body: string; createdAt: number }; // createdAt: epoch ms
type Snapshot = { version: number; language: string; participants: Participant[]; messages: ChatMessage[] }; // version counts applied updates; messages are the latest 50
```

### Joining and syncing

1. The client sends `join-room` and receives `room-sync`.
2. The server sends `yjs-sync` with sync step 1 (its state vector). The client answers with
   step 2: every change the server is missing (offline edits, or edits the server lost in
   a crash).
3. The client sends `yjs-sync` with its own step 1. The server answers with step 2 (the
   document) and a `yjs-awareness` message with everyone's cursors.
4. From then on both sides send `yjs-sync` update messages as edits happen. The server
   relays each accepted update and awareness change to the rest of the room.

After a reconnect the client repeats all four steps with the document it already has.

### Client → server

| Event | Payload | Server reply |
| --- | --- | --- |
| `join-room` | `{ roomId, name }`: `roomId` is 1–64 letters, digits, `.`, `_`, `-` and starts with a letter or digit. `name` is 1–32 characters with no control or bidi-override characters. | `room-sync` and `yjs-sync` (step 1) to the sender, `participant-joined` to the others, or `room-error` |
| `leave-room` | none | `participant-left` and an awareness removal to the others |
| `yjs-sync` | `{ roomId, data }`: sync step 1, step 2 or update | Step 1: `yjs-sync` (step 2) and `yjs-awareness`. Step 2 or update: relayed to the others. If the change would make the text longer than 100,000 characters, contains a carriage return, or is malformed or too large: `document-error` with `reset: true`. |
| `yjs-awareness` | `{ roomId, data }`: an awareness update for the sender's own client id | Relayed to the others. The server keeps only `cursor` (Yjs relative positions `{ anchor, head }`) and `typing`, and sets `user` to the server's record `{ socketId, name, color }`. Updates for client ids first used by another socket are ignored. |
| `language-change` | `{ roomId, language }`: one of `javascript`, `typescript`, `java`, `cpp`, `python`, `json`, `css`, `html`, `markdown` | `language-changed` to the others |
| `chat-send` | `{ roomId, body, clientId? }`: `body` is 1–1,000 characters after trimming, with no control characters except newline and tab. `clientId` (up to 64 characters) is echoed back so the sender can match its pending copy. Limit: 10 messages per 10 seconds per connection. | `chat-message` to everyone in the room, including the sender, or `chat-error` to the sender |

### Server → client

| Event | Payload | When |
| --- | --- | --- |
| `room-sync` | `{ roomId } & Snapshot` | After a successful `join-room` |
| `room-error` | `{ message }` | Invalid join payload, or the room already has `MAX_PARTICIPANTS_PER_ROOM` people |
| `participant-joined` | `Participant` | Someone else joined your room |
| `participant-left` | `{ socketId }` | Someone left or disconnected |
| `yjs-sync` | `{ roomId, data }` | Sync handshake messages and other people's updates |
| `yjs-awareness` | `{ roomId, data }` | Other people's cursors and typing state changed |
| `document-error` | `{ message, reset: true }` | Your change was refused. It is already applied in your editor and Yjs changes cannot be taken back, so discard your local document and sync a fresh one. |
| `language-changed` | `{ language }` | Someone changed the room's language |
| `chat-message` | `ChatMessage & { clientId? }` | A message was posted. The author and time are set by the server. |
| `chat-error` | `{ message, clientId? }` | Your message was refused (invalid, too fast, or not stored) |
| `server-error` | `{ message }` | A handler failed unexpectedly, or you are sending events too quickly. If a document update was dropped, the server restarts the sync handshake once the rate-limit window resets. |

Each connection may send 200 events and 4 MB of Yjs data per 5 seconds.

### Line endings

The shared text only ever contains `\n` line breaks, never `\r`. Editors that count a
line break as one character (Monaco with its end-of-line set to LF) then use the same
offsets as `Y.Text`. The server refuses updates that would add `\r`, and converts
`\r\n` in rooms saved before this rule.

## Persistence and room lifecycle

- Each room's Yjs document (`ydoc`), a plain-text copy (`content`) and its language are
  stored in SQLite (`DATABASE_PATH`, default `server/data/collabcode.db`). Participants
  and cursors are never stored. Rooms saved before Yjs are converted on first open.
- Changes are saved in batches every 2 seconds, immediately when the last person leaves,
  and during graceful shutdown. A crash can lose up to about 2 seconds of edits; the sync
  handshake gets them back from any client that still has them.
- Rooms that were opened but never edited are not stored.
- Chat messages are stored in `chat_messages` and deleted with their room. Each room keeps
  its newest 500 messages.
- The task list lives in the same Yjs document as the code (a `Y.Array` named `tasks` of
  `Y.Map`s with `id`, `text`, `done`, `createdBy`), so it syncs, persists and merges
  offline edits the same way.
- An empty room is removed from memory after `EMPTY_ROOM_TTL_MINUTES` (default 30) and
  reloaded from the database on the next join.
- A stored room nobody opens for `ROOM_RETENTION_DAYS` (default 30) is deleted.
- Migrations live in `server/src/db/migrations/` and run automatically at start-up, each
  in its own transaction. Add a new numbered file; never edit one that has shipped.

## Running more than one server instance

The current design assumes a single instance: each open room's Yjs document lives in that
process's memory, and SQLite is a local file. Running several instances behind a load
balancer needs:

1. **Sticky sessions**, or WebSocket-only clients (already the default), so a client's
   connection stays on one instance.
2. **A shared Socket.io adapter** such as `@socket.io/redis-adapter`, so broadcasts reach
   clients connected to other instances.
3. **Shared document updates.** Yjs updates merge in any order, so each instance can keep
   its own copy of a room as long as every update also reaches the other instances' copies,
   for example by publishing updates over Redis (as `y-redis` does). Broadcasting through
   the adapter alone is not enough, because the server-side document on other instances
   would fall behind.
4. **A shared database** (for example Postgres) in place of the local SQLite file.
