import { DatabaseSync } from 'node:sqlite';
import { isInternalTable } from './isInternalTable.js';

/** Rows per table of a database file, by table name, leaving out the internal tables. */
export function countRows(path: string): Record<string, number> {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row.name))
      .filter((name) => !isInternalTable(name));
    return Object.fromEntries(
      tables.map((name) => [
        name,
        Number(
          (
            db.prepare(`SELECT COUNT(*) AS n FROM "${name.replace(/"/g, '""')}"`).get() as {
              n: number;
            }
          ).n,
        ),
      ]),
    );
  } finally {
    db.close();
  }
}
