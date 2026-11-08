import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { describeSchema } from './support/describeSchema.js';

const schemaSql = readFileSync(
  new URL('../d1/migrations/0001_schema.sql', import.meta.url),
  'utf8',
);

function fromMigrations(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  new MigrationRunner(db, migrations).run();
  return db;
}

function fromSql(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(schemaSql);
  return db;
}

describe('D1 schema file', () => {
  const expected = describeSchema(fromMigrations(), ['schema_migrations']);
  const actual = describeSchema(fromSql(), []);

  it('has the same tables as the TypeScript migrations', () => {
    expect(Object.keys(actual.tables)).toEqual(Object.keys(expected.tables));
  });

  it('has the same columns, defaults and keys in every table', () => {
    expect(actual.tables).toEqual(expected.tables);
  });

  it('has the same foreign keys', () => {
    expect(actual.foreignKeys).toEqual(expected.foreignKeys);
  });

  it('has the same indexes, including unique and partial ones', () => {
    expect(actual.indexes).toEqual(expected.indexes);
  });

  it('has the same explicit index definitions', () => {
    expect(actual.indexSql).toEqual(expected.indexSql);
  });

  it('has no views or triggers', () => {
    expect(actual.other).toEqual(expected.other);
    expect(actual.other).toEqual([]);
  });

  it('seeds only the owner user', () => {
    const users = fromSql().prepare('SELECT id, name, email, role FROM user').all();
    expect(users.map((u) => ({ ...u }))).toEqual([
      { id: 1, name: 'Owner', email: null, role: 'owner' },
    ]);
    expect(fromSql().prepare('SELECT COUNT(*) AS n FROM user_setting').get()).toEqual({ n: 0 });
  });

  it('seeds the same rows as the TypeScript migrations', () => {
    const rows = (db: DatabaseSync) =>
      db
        .prepare('SELECT id, name, email, role, handle, deletion_requested_at FROM user')
        .all()
        .map((u) => ({ ...u }));
    expect(rows(fromSql())).toEqual(rows(fromMigrations()));
  });

  it('passes the foreign key check', () => {
    expect(fromSql().prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
