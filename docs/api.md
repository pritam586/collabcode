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

Positions use Monaco's convention: 1-based line and column numbers.

```ts
type Range = { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
type Delta = { range: Range; text: string };            // replace `range` with `text`; text ≤ 25,000 chars
type Participant = { socketId: string; name: string; color: 'violet' | 'cyan' | 'amber' | 'rose' | 'lime' | 'sky'; cursor: Range | null };
type Snapshot = { content: string; version: number; language: string; participants: Participant[] };
```

### Client → server

| Event | Payload | Server reply |
| --- | --- | --- |
| `join-room` | `{ roomId, name }`: `roomId` is 1–64 letters, digits, `.`, `_`, `-` and starts with a letter or digit. `name` is 1–32 characters with no control or bidi-override characters. | `room-sync` to the sender, `participant-joined` to the others, or `room-error` |
| `leave-room` | none | `participant-left` to the others |
| `code-change` | `{ roomId, version, delta: Delta }`. `version` must equal the server's current version. | `change-accepted` to the sender and `remote-change` to the others. On a stale version: `force-resync`. On an invalid delta or a document over 100,000 characters: `document-error` + `force-resync`. |
| `request-resync` | `{ roomId }` | `force-resync` |
| `language-change` | `{ roomId, language }`: one of `javascript`, `typescript`, `java`, `cpp`, `python`, `json`, `css`, `html`, `markdown` | `language-changed` to the others |
| `cursor-update` | `{ roomId, position: Range }`, with start before end | `remote-cursor` to the others |

### Server → client

| Event | Payload | When |
| --- | --- | --- |
| `room-sync` | `{ roomId } & Snapshot` | After a successful `join-room` |
| `room-error` | `{ message }` | Invalid join payload, or the room already has `MAX_PARTICIPANTS_PER_ROOM` people |
| `participant-joined` | `Participant` | Someone else joined your room |
| `participant-left` | `{ socketId }` | Someone left or disconnected |
| `change-accepted` | `{ version }` | Your `code-change` was applied. Send your next one only after this arrives. |
| `remote-change` | `{ delta: Delta, version }` | Someone else's edit was applied. Apply it if `version` is your version + 1; otherwise request a resync. |
| `force-resync` | `Snapshot` | Replace your document with this one |
| `document-error` | `{ message }` | Your edit could not be applied |
| `language-changed` | `{ language }` | Someone changed the room's language |
| `remote-cursor` | `{ socketId, position: Range, name, color }` | Someone moved their cursor or selection |
| `server-error` | `{ message }` | A handler failed unexpectedly, or you are sending events too quickly |

## Persistence and room lifecycle

- Room content, language and version are stored in SQLite (`DATABASE_PATH`, default
  `server/data/collabcode.db`). Participants and cursors are never stored.
- Changes are saved in batches every 2 seconds, immediately when the last person leaves,
  and during graceful shutdown. A crash can lose up to about 2 seconds of edits. A
  reconnecting client whose version is newer than the server's restores its own copy.
- Rooms that were opened but never edited are not stored.
- An empty room is removed from memory after `EMPTY_ROOM_TTL_MINUTES` (default 30) and
  reloaded from the database on the next join.
- A stored room nobody opens for `ROOM_RETENTION_DAYS` (default 30) is deleted.
- Migrations live in `server/src/db/migrations/` and run automatically at start-up, each
  in its own transaction. Add a new numbered file; never edit one that has shipped.

## Running more than one server instance

The current design assumes a single instance: live room state is in that process's memory,
and SQLite is a local file. Running several instances behind a load balancer needs:

1. **Sticky sessions**, or WebSocket-only clients (already the default), so a client's
   connection stays on one instance.
2. **A shared Socket.io adapter** such as `@socket.io/redis-adapter`, so broadcasts reach
   clients connected to other instances.
3. **One authority per room.** Today's versioned-delta protocol needs a single
   in-memory copy of each document. Either route every room to one instance (for example
   by hashing the room id), or move to a CRDT such as Yjs (planned), whose updates can be
   merged on any instance.
4. **A shared database** (for example Postgres) in place of the local SQLite file.
