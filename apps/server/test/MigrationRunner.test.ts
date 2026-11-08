import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import type { Migration } from '../src/storage/Migration.js';
import { migrations } from '../src/storage/migrations/index.js';
import { LATEST_SCHEMA_VERSION } from './support/latestSchemaVersion.js';

describe('MigrationRunner', () => {
  it('starts at version 0 on an empty database', () => {
    const runner = new MigrationRunner(new DatabaseSync(':memory:'), migrations);
    expect(runner.currentVersion()).toBe(0);
  });

  it('applies all migrations and is idempotent', () => {
    const runner = new MigrationRunner(new DatabaseSync(':memory:'), migrations);
    expect(runner.run()).toBe(LATEST_SCHEMA_VERSION);
    expect(runner.run()).toBe(LATEST_SCHEMA_VERSION);
  });

  it('rolls back a failing migration', () => {
    const db = new DatabaseSync(':memory:');
    const failing: Migration = {
      version: LATEST_SCHEMA_VERSION + 1,
      name: 'failing',
      up: (d) => {
        d.exec('CREATE TABLE t (id INTEGER)');
        throw new Error('boom');
      },
    };
    const runner = new MigrationRunner(db, [...migrations, failing]);
    expect(() => runner.run()).toThrow('boom');
    expect(runner.currentVersion()).toBe(LATEST_SCHEMA_VERSION);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE name = 't'").get();
    expect(row).toBeUndefined();
  });

  it('accepts gaps in the versions', () => {
    const gap: Migration = { version: LATEST_SCHEMA_VERSION + 2, name: 'gap', up: () => {} };
    const runner = new MigrationRunner(new DatabaseSync(':memory:'), [...migrations, gap]);
    expect(runner.run()).toBe(LATEST_SCHEMA_VERSION + 2);
  });

  it('rejects versions that do not increase', () => {
    const repeated: Migration = { version: LATEST_SCHEMA_VERSION, name: 'again', up: () => {} };
    expect(
      () => new MigrationRunner(new DatabaseSync(':memory:'), [...migrations, repeated]),
    ).toThrow();
  });

  it('applies a migration that fills a gap after later ones were applied', () => {
    const db = new DatabaseSync(':memory:');
    const early: Migration = { version: 1, name: 'early', up: (d) => d.exec('CREATE TABLE a (x)') };
    const late: Migration = { version: 3, name: 'late', up: (d) => d.exec('CREATE TABLE c (x)') };
    const between: Migration = {
      version: 2,
      name: 'between',
      up: (d) => d.exec('CREATE TABLE b (x)'),
    };
    new MigrationRunner(db, [early, late]).run();
    expect(new MigrationRunner(db, [early, between, late]).run()).toBe(3);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE name IN ('a','b','c')").all();
    expect(names).toHaveLength(3);
  });
});
