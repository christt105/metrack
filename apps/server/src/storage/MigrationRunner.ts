import type { DatabaseSync } from 'node:sqlite';
import type { Migration } from './Migration.js';

/** Applies versioned migrations in order, each inside its own transaction. */
export class MigrationRunner {
  constructor(
    private readonly db: DatabaseSync,
    private readonly migrations: readonly Migration[],
  ) {
    const versions = migrations.map((m) => m.version);
    if (versions.some((v, i) => v !== i + 1)) {
      throw new Error('Migration versions must be contiguous and start at 1');
    }
  }

  currentVersion(): number {
    this.ensureControlTable();
    const row = this.db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get();
    return Number(row?.version ?? 0);
  }

  run(): number {
    const current = this.currentVersion();
    for (const migration of this.migrations.filter((m) => m.version > current)) {
      const foreignKeys = this.foreignKeysEnabled();
      if (migration.rebuildsTables) this.db.exec('PRAGMA foreign_keys = OFF');
      this.db.exec('BEGIN');
      try {
        migration.up(this.db);
        if (migration.rebuildsTables) this.checkForeignKeys(migration);
        this.db
          .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, new Date().toISOString());
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      } finally {
        if (migration.rebuildsTables && foreignKeys) this.db.exec('PRAGMA foreign_keys = ON');
      }
    }
    return this.currentVersion();
  }

  private foreignKeysEnabled(): boolean {
    return Number(this.db.prepare('PRAGMA foreign_keys').get()?.foreign_keys) === 1;
  }

  private checkForeignKeys(migration: Migration): void {
    const broken = this.db.prepare('PRAGMA foreign_key_check').all();
    if (broken.length > 0) {
      throw new Error(
        `Migration ${migration.version} broke ${broken.length} foreign key references`,
      );
    }
  }

  private ensureControlTable(): void {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )`,
    );
  }
}
