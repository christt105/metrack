import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { countRows } from '../src/cloudbackup/countRows.js';
import { dumpStatements, MAX_STATEMENT_BYTES } from '../src/cloudbackup/dumpStatements.js';
import { dumpToSql } from '../src/cloudbackup/dumpToSql.js';
import { formatRowCounts } from '../src/cloudbackup/formatRowCounts.js';
import { importD1Dump } from '../src/cloudbackup/importD1Dump.js';
import { d1Dump } from './support/d1Dump.js';

function copy(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dump-'));
  const path = join(dir, 'copy.db');
  importD1Dump(d1Dump(['abc.webp']), path);
  return path;
}

describe('importD1Dump', () => {
  it('loads a D1 export whose rows come before the rows they reference', () => {
    const db = new DatabaseSync(copy(), { readOnly: true });
    expect(db.prepare('SELECT note FROM child').get()).toEqual({ note: "line one\nit's two" });
    db.close();
  });
});

describe('dumpToSql', () => {
  it('writes SQL without transactions or internal tables, tables first and indexes last', () => {
    const sql = dumpToSql(copy());
    const lines = sql.split('\n');
    expect(lines[0]).toBe('PRAGMA defer_foreign_keys=TRUE;');
    expect(sql).not.toMatch(/^(BEGIN|COMMIT)/m);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "d1_migrations"');
    expect(sql).toContain('INSERT OR IGNORE INTO "d1_migrations"');
    expect(sql.indexOf('CREATE TABLE parent')).toBeLessThan(sql.indexOf('INSERT INTO "parent"'));
    expect(sql.indexOf('INSERT INTO "child"')).toBeLessThan(
      sql.indexOf('CREATE INDEX child_parent'),
    );
    expect(sql).not.toMatch(/CREATE TABLE "?sqlite_/);
  });

  it('round-trips every value, including newlines, quotes, blobs and tricky text, in one transaction', () => {
    const path = copy();
    const db = new DatabaseSync(path);
    db.prepare('INSERT INTO parent (id, name) VALUES (2, ?)').run('a\\n{{NL}}\r\nb\rc');
    db.prepare('INSERT INTO child (id, parent_id, note, data) VALUES (2, 2, ?, ?)').run(
      'x',
      new Uint8Array([1, 2, 3]),
    );
    db.close();
    const sql = dumpToSql(path);
    expect(sql.split('\n').every((line) => !line.includes('\r'))).toBe(true);
    const restored = new DatabaseSync(':memory:');
    restored.exec(`BEGIN;${sql}COMMIT;`);
    expect(restored.prepare('SELECT name FROM parent WHERE id = 2').get()).toEqual({
      name: 'a\\n{{NL}}\r\nb\rc',
    });
    expect(restored.prepare('SELECT data FROM child WHERE id = 2').get()).toEqual({
      data: new Uint8Array([1, 2, 3]),
    });
    expect(restored.prepare('SELECT seq FROM sqlite_sequence').get()).toEqual({ seq: 4 });
    expect(restored.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    restored.close();
  });

  it('handles a database without AUTOINCREMENT tables', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dump-'));
    const path = join(dir, 'plain.db');
    const db = new DatabaseSync(path);
    db.exec('CREATE TABLE t (a INTEGER); INSERT INTO t VALUES (1);');
    db.close();
    expect(dumpToSql(path)).toContain('INSERT INTO "t" ("a") VALUES(1);');
  });
});

describe('countRows', () => {
  it('counts the rows of each table and leaves out the internal ones', () => {
    const counts = countRows(copy());
    expect(counts).toEqual({ child: 1, d1_migrations: 1, image: 1, parent: 1 });
    expect(formatRowCounts(counts)).toBe(
      'child: 1\nd1_migrations: 1\nimage: 1\nparent: 1\ntotal: 4',
    );
  });
});

describe('dumpStatements', () => {
  function bigDatabase(): { path: string; text: string; blob: Uint8Array } {
    const dir = mkdtempSync(join(tmpdir(), 'dump-'));
    const path = join(dir, 'big.db');
    const text = Array.from(
      { length: 6000 },
      (_, i) => `línea ${i} con ñ, 日本語, 😀 y 'comillas' {{NL}}\\n`,
    ).join('\n');
    const blob = new Uint8Array(150_000).map((_, i) => (i * 7) % 256);
    const db = new DatabaseSync(path);
    db.exec(`CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent (id) ON DELETE CASCADE);
      CREATE TABLE parent (id INTEGER PRIMARY KEY, body TEXT, data BLOB, note TEXT);
      CREATE TABLE tree (id INTEGER PRIMARY KEY, up INTEGER REFERENCES tree (id));
      CREATE TABLE keyed (k TEXT PRIMARY KEY, v TEXT) WITHOUT ROWID;
      INSERT INTO parent (id, body, data, note) VALUES (1, NULL, NULL, 'short');
      INSERT INTO child VALUES (1, 1);
      INSERT INTO tree VALUES (1, NULL), (2, 1);`);
    db.prepare('UPDATE parent SET body = ?, data = ? WHERE id = 1').run(text, blob);
    db.prepare('INSERT INTO keyed VALUES (?, ?)').run('k1', text);
    db.close();
    return { path, text, blob };
  }

  it('keeps every statement under the limit and round-trips statement by statement with foreign keys on', () => {
    const { path } = bigDatabase();
    const statements = dumpStatements(path);
    expect(Math.max(...statements.map((statement) => Buffer.byteLength(statement)))).toBeLessThan(
      MAX_STATEMENT_BYTES,
    );
    expect(statements.filter((statement) => statement.startsWith('UPDATE')).length).toBeGreaterThan(
      5,
    );
    expect(
      statements.indexOf(statements.find((s) => s.startsWith('INSERT INTO "parent"'))!),
    ).toBeLessThan(
      statements.indexOf(statements.find((s) => s.startsWith('INSERT INTO "child"'))!),
    );
    const restored = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
    for (const statement of statements.filter((line) => !line.startsWith('PRAGMA'))) {
      restored.exec(statement);
    }
    restored.exec(`ATTACH '${path}' AS src`);
    for (const table of ['child', 'parent', 'tree', 'keyed']) {
      const missing = restored
        .prepare(
          `SELECT COUNT(*) AS n FROM (SELECT * FROM src."${table}" EXCEPT SELECT * FROM main."${table}")`,
        )
        .get() as { n: number };
      const extra = restored
        .prepare(
          `SELECT COUNT(*) AS n FROM (SELECT * FROM main."${table}" EXCEPT SELECT * FROM src."${table}")`,
        )
        .get() as { n: number };
      expect([table, missing.n, extra.n]).toEqual([table, 0, 0]);
    }
    const blob = restored.prepare('SELECT length(data) AS n, typeof(data) AS t FROM parent').get();
    expect(blob).toEqual({ n: 150_000, t: 'blob' });
    restored.close();
  });
});
