// Timestamps are Unix epoch milliseconds.
export default {
  version: 1,
  name: 'create_rooms',
  up: `
    CREATE TABLE rooms (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'javascript',
      doc_version INTEGER NOT NULL DEFAULT 0 CHECK (doc_version >= 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    ) STRICT;

    -- Retention cleanup deletes rooms nobody has used for a while.
    CREATE INDEX rooms_last_active_at_idx ON rooms (last_active_at);
  `,
};
