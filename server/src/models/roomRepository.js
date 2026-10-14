import { transaction } from '../db/database.js';

// All SQL for the rooms table. Rows are mapped to camelCase plain objects.
export function createRoomRepository(db) {
  const findStatement = db.prepare('SELECT * FROM rooms WHERE id = ?');
  const upsertStatement = db.prepare(`
    INSERT INTO rooms (id, content, ydoc, language, doc_version, created_at, updated_at, last_active_at)
    VALUES (:id, :content, :ydoc, :language, :docVersion, :createdAt, :updatedAt, :lastActiveAt)
    ON CONFLICT (id) DO UPDATE SET
      content = excluded.content,
      ydoc = excluded.ydoc,
      language = excluded.language,
      doc_version = excluded.doc_version,
      updated_at = excluded.updated_at,
      last_active_at = excluded.last_active_at
  `);
  const purgeStatement = db.prepare('DELETE FROM rooms WHERE last_active_at < ? AND id NOT IN (SELECT value FROM json_each(?))');
  const countStatement = db.prepare('SELECT COUNT(*) AS count FROM rooms');

  return {
    find(id) {
      const row = findStatement.get(id);
      return row ? toRoom(row) : null;
    },

    saveMany(rooms) {
      transaction(db, () => {
        for (const room of rooms) {
          upsertStatement.run({
            id: room.id,
            content: room.content,
            ydoc: room.ydoc ?? null,
            language: room.language,
            docVersion: room.docVersion,
            createdAt: room.createdAt,
            updatedAt: room.updatedAt,
            lastActiveAt: room.lastActiveAt,
          });
        }
      });
    },

    // Deletes rooms inactive since `before`, except ids that are open right now.
    deleteInactive(before, keepIds = []) {
      return Number(purgeStatement.run(before, JSON.stringify(keepIds)).changes);
    },

    count() {
      return Number(countStatement.get().count);
    },
  };
}

function toRoom(row) {
  return {
    id: row.id,
    content: row.content,
    ydoc: row.ydoc ?? null,
    language: row.language,
    docVersion: Number(row.doc_version),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastActiveAt: Number(row.last_active_at),
  };
}
