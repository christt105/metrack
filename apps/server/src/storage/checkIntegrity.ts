import { DatabaseSync } from 'node:sqlite';

/** Runs PRAGMA integrity_check on a database file opened read-only; throws unless it reports "ok". */
export function checkIntegrity(path: string): void {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const rows = db.prepare('PRAGMA integrity_check').all() as { integrity_check: string }[];
    const problems = rows.map((row) => row.integrity_check).filter((line) => line !== 'ok');
    if (rows.length === 0 || problems.length > 0) {
      throw new Error(`Integrity check failed for ${path}: ${problems.join('; ') || 'no result'}`);
    }
  } finally {
    db.close();
  }
}
