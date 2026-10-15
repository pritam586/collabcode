import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrations } from './migrations/index.js';

// Opens (creating if needed) the SQLite database and brings its schema up to date.
// Pass ':memory:' for a throwaway database in tests.
export function openDatabase(path, { logger } = {}) {
  const inMemory = path === ':memory:';
  const location = inMemory ? path : resolve(path);
  if (!inMemory) mkdirSync(dirname(location), { recursive: true });

  const db = new DatabaseSync(location);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  // WAL lets reads continue while a write is in progress; NORMAL sync is safe with WAL.
  if (!inMemory) db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

  runMigrations(db, migrations, logger);
  return db;
}

export function runMigrations(db, pending, logger) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  ) STRICT`);

  const applied = new Set(
    db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => row.version),
  );
  const record = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');

  for (const migration of [...pending].sort((a, b) => a.version - b.version)) {
    if (applied.has(migration.version)) continue;
    transaction(db, () => {
      db.exec(migration.up);
      record.run(migration.version, migration.name, Date.now());
    });
    logger?.info({ version: migration.version, migration: migration.name }, 'Applied database migration');
  }
}

export function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
