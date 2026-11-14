import { DatabaseSync } from 'node:sqlite';

/** Loads a D1 SQL export into a new SQLite file. Foreign keys are not enforced while loading, as D1 defers them. */
export function importD1Dump(sql: string, path: string): void {
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: false });
  try {
    db.exec('PRAGMA journal_mode = OFF');
    db.exec('PRAGMA synchronous = OFF');
    db.exec('BEGIN');
    db.exec(sql);
    db.exec('COMMIT');
  } finally {
    db.close();
  }
}
