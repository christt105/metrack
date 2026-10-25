import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import type { Migration } from '../src/storage/Migration.js';
import { migrations } from '../src/storage/migrations/index.js';

describe('MigrationRunner', () => {
  it('starts at version 0 on an empty database', () => {
    const runner = new MigrationRunner(new DatabaseSync(':memory:'), migrations);
    expect(runner.currentVersion()).toBe(0);
  });

  it('applies all migrations and is idempotent', () => {
    const runner = new MigrationRunner(new DatabaseSync(':memory:'), migrations);
    expect(runner.run()).toBe(migrations.length);
    expect(runner.run()).toBe(migrations.length);
  });

  it('rolls back a failing migration', () => {
    const db = new DatabaseSync(':memory:');
    const failing: Migration = {
      version: migrations.length + 1,
      name: 'failing',
      up: (d) => {
        d.exec('CREATE TABLE t (id INTEGER)');
        throw new Error('boom');
      },
    };
    const runner = new MigrationRunner(db, [...migrations, failing]);
    expect(() => runner.run()).toThrow('boom');
    expect(runner.currentVersion()).toBe(migrations.length);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE name = 't'").get();
    expect(row).toBeUndefined();
  });

  it('rejects non-contiguous versions', () => {
    const gap: Migration = { version: migrations.length + 2, name: 'gap', up: () => {} };
    expect(() => new MigrationRunner(new DatabaseSync(':memory:'), [...migrations, gap])).toThrow();
  });
});
