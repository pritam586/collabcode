// All SQL for the chat_messages table. The room row must exist before a message is added.
export function createChatRepository(db) {
  const insertStatement = db.prepare(`
    INSERT INTO chat_messages (room_id, author_name, author_color, body, created_at)
    VALUES (?, ?, ?, ?, ?)
    RETURNING id
  `);
  const recentStatement = db.prepare('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY id DESC LIMIT ?');
  // Deletes everything older than the newest `keep` messages of a room.
  const trimStatement = db.prepare(`
    DELETE FROM chat_messages
    WHERE room_id = ? AND id < (
      SELECT MIN(id) FROM (SELECT id FROM chat_messages WHERE room_id = ? ORDER BY id DESC LIMIT ?)
    )
  `);

  return {
    add({ roomId, authorName, authorColor, body, createdAt }) {
      const { id } = insertStatement.get(roomId, authorName, authorColor, body, createdAt);
      return Number(id);
    },

    // Oldest first.
    recent(roomId, limit) {
      return recentStatement
        .all(roomId, limit)
        .reverse()
        .map((row) => ({
          id: Number(row.id),
          author: { name: row.author_name, color: row.author_color },
          body: row.body,
          createdAt: Number(row.created_at),
        }));
    },

    trim(roomId, keep) {
      return Number(trimStatement.run(roomId, roomId, keep).changes);
    },
  };
}
