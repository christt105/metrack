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

const renderCacheSql = readFileSync(
  new URL('../d1/migrations/0002_public_render_cache.sql', import.meta.url),
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

  it('has the same CHECK constraints', () => {
    expect(actual.checks).toEqual(expected.checks);
    expect(Object.values(actual.checks).flat()).not.toHaveLength(0);
  });

  it('has no views or triggers', () => {
    expect(actual.other).toEqual(expected.other);
    expect(actual.other).toEqual([]);
  });

  it('holds no data', () => {
    const tables = fromSql()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String(row.name));
    const db = fromSql();
    for (const name of tables) {
      expect(db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get(), name).toEqual({ n: 0 });
    }
  });

  it('passes the foreign key check', () => {
    expect(fromSql().prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});

describe('D1 render cache migration', () => {
  it('adds only the content version and the public_render table to the home schema', () => {
    const before = describeSchema(fromSql(), []);
    const db = fromSql();
    db.exec(renderCacheSql);
    const after = describeSchema(db, []);
    expect(Object.keys(after.tables)).toEqual(
      [...Object.keys(before.tables), 'public_render'].sort(),
    );
    const { user: beforeUser, ...otherBefore } = before.tables;
    const { user: afterUser, public_render: cache, ...otherAfter } = after.tables;
    expect(otherAfter).toEqual(otherBefore);
    expect(afterUser).toHaveLength((beforeUser ?? []).length + 1);
    expect(afterUser).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'content_version', notnull: 1, dflt_value: '0' }),
      ]),
    );
    expect(cache).toHaveLength(5);
    expect(after.indexes).toEqual(expect.objectContaining(before.indexes));
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
