import { DatabaseSync } from 'node:sqlite';

/** The image file names a database lists, or undefined when it cannot be read. */
export function listedImages(databasePath: string): string[] | undefined {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(databasePath, { readOnly: true });
    return db
      .prepare('SELECT hash, extension FROM image')
      .all()
      .map((row) => `${String(row.hash)}.${String(row.extension)}`);
  } catch {
    return undefined;
  } finally {
    db?.close();
  }
}
