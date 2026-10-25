import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackupService } from '../src/backup/BackupService.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { openDatabase } from '../src/storage/openDatabase.js';

let dir: string;
let db: DatabaseSync;
let clock: Date;
let service: BackupService;

function dump(database: DatabaseSync): string {
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  return JSON.stringify(
    tables.map(({ name }) => [name, database.prepare(`SELECT * FROM "${name}"`).all()]),
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'metrack-backup-'));
  db = openDatabase(join(dir, 'metrack.db'));
  new MigrationRunner(db, migrations).run();
  db.exec('CREATE TABLE note (id INTEGER PRIMARY KEY, body TEXT)');
  db.exec("INSERT INTO note (body) VALUES ('first'), ('second')");
  clock = new Date('2026-10-24T10:00:00.000Z');
  service = new BackupService(
    db,
    { dbPath: join(dir, 'metrack.db'), imagesDir: join(dir, 'images') },
    join(dir, 'backups'),
    () => clock,
  );
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('BackupService', () => {
  it('creates a verified backup without an image store', () => {
    const info = service.create();
    expect(info.name).toBe('metrack-20261024T100000000Z');
    expect(info.createdAt).toBe('2026-10-24T10:00:00.000Z');
    expect(info.hasImages).toBe(false);
    expect(info.sizeBytes).toBeGreaterThan(0);
    expect(() => service.verify(info.name)).not.toThrow();
  });

  it('includes the image store when it exists', () => {
    mkdirSync(join(dir, 'images', 'sub'), { recursive: true });
    writeFileSync(join(dir, 'images', 'sub', 'a.jpg'), 'img');
    const info = service.create();
    expect(info.hasImages).toBe(true);
    expect(readFileSync(join(dir, 'backups', info.name, 'images', 'sub', 'a.jpg'), 'utf8')).toBe(
      'img',
    );
  });

  it('lists backups newest first and prunes to the retention count', () => {
    for (const hour of [10, 11, 12]) {
      clock = new Date(`2026-10-24T${hour}:00:00.000Z`);
      service.create();
    }
    expect(service.list().map((b) => b.name)).toEqual([
      'metrack-20261024T120000000Z',
      'metrack-20261024T110000000Z',
      'metrack-20261024T100000000Z',
    ]);
    expect(service.prune(2)).toEqual(['metrack-20261024T100000000Z']);
    expect(service.list()).toHaveLength(2);
  });

  it('refuses to overwrite an existing backup and leaves no partial directory', () => {
    service.create();
    expect(() => service.create()).toThrow('already exists');
    expect(service.list()).toHaveLength(1);
  });

  it('restores a backup so the database and images match the original', () => {
    mkdirSync(join(dir, 'images'));
    writeFileSync(join(dir, 'images', 'a.jpg'), 'original');
    const expected = dump(db);
    const { name } = service.create();

    db.exec("INSERT INTO note (body) VALUES ('after backup'), ('more')");
    db.exec('DROP TABLE schema_migrations');
    writeFileSync(join(dir, 'images', 'a.jpg'), 'changed');
    writeFileSync(join(dir, 'images', 'stray.jpg'), 'stray');
    db.close();

    service.restore(name);

    const restored = openDatabase(join(dir, 'metrack.db'));
    expect(dump(restored)).toBe(expected);
    restored.close();
    expect(readFileSync(join(dir, 'images', 'a.jpg'), 'utf8')).toBe('original');
    expect(existsSync(join(dir, 'images', 'stray.jpg'))).toBe(false);
    expect(existsSync(join(dir, 'metrack.db.restoring'))).toBe(false);
    expect(existsSync(join(dir, 'images.restoring'))).toBe(false);
  });

  it('moves the replaced database and images to a safety directory before restoring', () => {
    mkdirSync(join(dir, 'images'));
    writeFileSync(join(dir, 'images', 'a.jpg'), 'original');
    const { name } = service.create();

    db.exec("INSERT INTO note (body) VALUES ('after backup')");
    writeFileSync(join(dir, 'images', 'a.jpg'), 'changed');
    writeFileSync(join(dir, 'images', 'stray.jpg'), 'stray');
    const beforeRestore = dump(db);
    db.close();

    clock = new Date('2026-10-25T08:00:00.000Z');
    const safetyDir = service.restore(name);

    expect(safetyDir).toBe(join(dir, 'pre-restore-20261025T080000000Z'));
    const saved = openDatabase(join(safetyDir, 'metrack.db'));
    expect(dump(saved)).toBe(beforeRestore);
    saved.close();
    expect(readFileSync(join(safetyDir, 'images', 'a.jpg'), 'utf8')).toBe('changed');
    expect(readFileSync(join(safetyDir, 'images', 'stray.jpg'), 'utf8')).toBe('stray');
    expect(service.list().map((b) => b.name)).toEqual([name]);
  });

  it('leaves the live data untouched when the safety directory cannot be created', () => {
    mkdirSync(join(dir, 'images'));
    writeFileSync(join(dir, 'images', 'a.jpg'), 'original');
    const { name } = service.create();
    writeFileSync(join(dir, 'images', 'a.jpg'), 'changed');
    db.close();
    mkdirSync(join(dir, 'pre-restore-20261024T100000000Z'));

    expect(() => service.restore(name)).toThrow();

    expect(readFileSync(join(dir, 'images', 'a.jpg'), 'utf8')).toBe('changed');
    expect(existsSync(join(dir, 'metrack.db.restoring'))).toBe(false);
    expect(existsSync(join(dir, 'images.restoring'))).toBe(false);
  });

  it('rejects a corrupted backup on verify and restore', () => {
    const { name } = service.create();
    writeFileSync(join(dir, 'backups', name, 'metrack.db'), 'not a database at all'.repeat(100));
    expect(() => service.verify(name)).toThrow();
    expect(() => service.restore(name)).toThrow();
  });

  it('rejects unknown and path-like backup names', () => {
    expect(() => service.verify('../etc')).toThrow('Unknown backup');
    expect(() => service.restore('metrack-20000101T000000000Z')).toThrow('Unknown backup');
  });
});
