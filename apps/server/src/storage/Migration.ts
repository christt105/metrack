import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
  /** Runs with foreign keys off, as rebuilding a referenced table needs; they are checked before committing. */
  rebuildsTables?: boolean;
}
