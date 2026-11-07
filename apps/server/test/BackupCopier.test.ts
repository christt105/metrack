import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackupCopier } from '../src/backup/BackupCopier.js';
import { BackupService } from '../src/backup/BackupService.js';
import { openDatabase } from '../src/storage/sqlite/openDatabase.js';

let dir: string;
let db: DatabaseSync;
let clock: Date;
let service: BackupService;
let copyDir: string;

function copier(retention = 365): BackupCopier {
  return new BackupCopier(service, join(dir, 'backups'), { dir: copyDir, retention });
}

function backupAt(iso: string): string {
  clock = new Date(iso);
  return service.create().name;
}

function addImage(name: string, content: string): void {
  mkdirSync(join(dir, 'images'), { recursive: true });
  writeFileSync(join(dir, 'images', name), content);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'metrack-backup-copy-'));
  copyDir = join(dir, 'hdd', 'metrack');
  db = openDatabase(join(dir, 'metrack.db'));
  db.exec('CREATE TABLE note (id INTEGER PRIMARY KEY, body TEXT)');
  db.exec("INSERT INTO note (body) VALUES ('first')");
  clock = new Date('2026-11-01T03:00:00.000Z');
  service = new BackupService(
    db,
    { dbPath: join(dir, 'metrack.db'), imagesDir: join(dir, 'images') },
    join(dir, 'backups'),
    () => clock,
  );
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('BackupCopier', () => {
  it('copies the database of each backup and every image once', () => {
    addImage('a.jpg', 'A');
    addImage('b.jpg', 'B');
    const first = backupAt('2026-11-01T03:00:00.000Z');

    expect(copier().sync()).toEqual({ copied: [first], images: 2, pruned: [] });
    expect(readdirSync(join(copyDir, 'databases'))).toEqual([`${first}.db`]);
    expect(readdirSync(join(copyDir, 'images')).sort()).toEqual(['a.jpg', 'b.jpg']);
    const copy = new DatabaseSync(join(copyDir, 'databases', `${first}.db`), { readOnly: true });
    expect(copy.prepare('SELECT body FROM note').all()).toEqual([{ body: 'first' }]);
    copy.close();

    expect(copier().sync()).toEqual({ copied: [], images: 0, pruned: [] });

    addImage('c.jpg', 'C');
    const second = backupAt('2026-11-02T03:00:00.000Z');
    expect(copier().sync()).toEqual({ copied: [second], images: 1, pruned: [] });
    expect(copier().list()).toEqual([second, first]);
  });

  it('catches up on every backup taken while the copy was unavailable, oldest first', () => {
    const first = backupAt('2026-11-01T03:00:00.000Z');
    const second = backupAt('2026-11-02T03:00:00.000Z');
    expect(copier().sync().copied).toEqual([first, second]);
  });

  it('keeps images in the copy after they leave the image store', () => {
    addImage('a.jpg', 'A');
    backupAt('2026-11-01T03:00:00.000Z');
    copier().sync();
    rmSync(join(dir, 'images', 'a.jpg'));
    backupAt('2026-11-02T03:00:00.000Z');
    copier().sync();
    expect(readFileSync(join(copyDir, 'images', 'a.jpg'), 'utf8')).toBe('A');
  });

  it('prunes the oldest copied databases beyond retention', () => {
    const names = ['01', '02', '03'].map((day) => backupAt(`2026-11-${day}T03:00:00.000Z`));
    expect(copier(2).sync().pruned).toEqual([names[0]]);
    expect(copier(2).list()).toEqual([names[2], names[1]]);
  });

  it('does not copy a database that fails the integrity check and leaves no partial file', () => {
    const name = backupAt('2026-11-01T03:00:00.000Z');
    writeFileSync(join(dir, 'backups', name, 'metrack.db'), 'not a database');
    expect(() => copier().sync()).toThrow();
    expect(readdirSync(join(copyDir, 'databases'))).toEqual([]);
  });

  it('rebuilds a copied backup under the backup folder so it can be restored', () => {
    addImage('a.jpg', 'A');
    const name = backupAt('2026-11-01T03:00:00.000Z');
    copier().sync();
    rmSync(join(dir, 'backups', name), { recursive: true });

    const rebuilt = copier().retrieve(name);
    expect(rebuilt).toBe(join(dir, 'backups', name));
    expect(readFileSync(join(rebuilt, 'images', 'a.jpg'), 'utf8')).toBe('A');
    expect(service.list().map((info) => info.name)).toEqual([name]);
    db.exec("UPDATE note SET body = 'changed'");
    db.close();
    service.restore(name);
    db = openDatabase(join(dir, 'metrack.db'));
    expect(db.prepare('SELECT body FROM note').all()).toEqual([{ body: 'first' }]);
  });

  it('refuses to retrieve an unknown copy or overwrite a local backup', () => {
    const name = backupAt('2026-11-01T03:00:00.000Z');
    expect(() => copier().retrieve(name)).toThrow('Unknown copied backup');
    copier().sync();
    expect(() => copier().retrieve(name)).toThrow('already exists locally');
    expect(() => copier().retrieve('../etc')).toThrow('Unknown copied backup');
    expect(existsSync(join(dir, 'backups', `.partial-${name}`))).toBe(false);
  });
});
