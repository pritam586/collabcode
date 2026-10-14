// Room chat. Messages are deleted with their room (retention cleanup) through the foreign key.
export default {
  version: 3,
  name: 'create_chat_messages',
  up: `
    CREATE TABLE chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_color TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX chat_messages_room_id_idx ON chat_messages (room_id, id);
  `,
};
