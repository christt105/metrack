import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CloudBackup } from '../src/cloudbackup/CloudBackup.js';
import { checkIntegrity } from '../src/storage/checkIntegrity.js';
import { d1Dump } from './support/d1Dump.js';
import { FakeD1 } from './support/FakeD1.js';
import { FakeR2 } from './support/FakeR2.js';

let dir: string;
let clock: Date;
let images: string[];
let failure: Error | undefined;
let r2: FakeR2;

function backup(retention = 14, withR2 = true): CloudBackup {
  return new CloudBackup(
    dir,
    retention,
    new FakeD1(() => failure ?? d1Dump(images)),
    withR2 ? r2 : undefined,
    () => clock,
  );
}

function at(iso: string): void {
  clock = new Date(iso);
}

const databases = () => readdirSync(join(dir, 'databases')).sort();
const imageFiles = () =>
  existsSync(join(dir, 'images')) ? readdirSync(join(dir, 'images')).sort() : [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cloud-backup-'));
  at('2026-11-14T04:30:00.000Z');
  images = [];
  failure = undefined;
  r2 = new FakeR2();
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('CloudBackup', () => {
  it('writes a checked database named like the home backups and reports what it did', async () => {
    const result = await backup().run();
    expect(result.name).toBe('metrack-20261114T043000000Z');
    expect(databases()).toEqual(['metrack-20261114T043000000Z.db']);
    checkIntegrity(join(dir, 'databases', `${result.name}.db`));
    expect(result.rows).toBe(3);
    expect(result.sqlBytes).toBe(Buffer.byteLength(d1Dump()));
    expect(result.databaseBytes).toBeGreaterThan(0);
    expect(backup().newest()).toEqual(clock);
  });

  it('downloads only the listed images it does not have, once', async () => {
    images = ['aaa.webp', 'bbb.png'];
    r2.put('aaa.webp');
    r2.put('bbb.png');
    r2.put('orphan.webp');
    const first = await backup().run();
    expect(first).toMatchObject({ images: 2, bucketObjects: 3, missingImages: 0 });
    expect(imageFiles()).toEqual(['aaa.webp', 'bbb.png']);
    at('2026-11-15T04:30:00.000Z');
    const second = await backup().run();
    expect(second.images).toBe(0);
    expect(r2.fetched).toEqual(['aaa.webp', 'bbb.png']);
  });

  it('counts the images a database lists that the bucket does not have', async () => {
    images = ['aaa.webp', 'gone.webp'];
    r2.put('aaa.webp');
    expect((await backup().run()).missingImages).toBe(1);
  });

  it('copies only the database when R2 is not configured', async () => {
    images = ['aaa.webp'];
    const result = await backup(14, false).run();
    expect(result).toMatchObject({ images: 0, bucketObjects: 0 });
    expect(existsSync(join(dir, 'images'))).toBe(false);
  });

  it('keeps the newest databases up to the retention and drops images no retained database lists', async () => {
    images = ['old.webp', 'shared.webp'];
    r2.put('old.webp');
    r2.put('shared.webp');
    await backup(2).run();
    at('2026-11-15T04:30:00.000Z');
    images = ['shared.webp', 'new.webp'];
    r2.put('new.webp');
    await backup(2).run();
    expect(imageFiles()).toEqual(['new.webp', 'old.webp', 'shared.webp']);
    at('2026-11-16T04:30:00.000Z');
    images = ['shared.webp', 'new.webp'];
    const third = await backup(2).run();
    expect(third.pruned).toEqual(['metrack-20261114T043000000Z']);
    expect(databases()).toEqual([
      'metrack-20261115T043000000Z.db',
      'metrack-20261116T043000000Z.db',
    ]);
    expect(third.prunedImages).toBe(1);
    expect(imageFiles()).toEqual(['new.webp', 'shared.webp']);
  });

  it('keeps every image when a retained database cannot be read', async () => {
    images = ['aaa.webp'];
    r2.put('aaa.webp');
    await backup().run();
    writeBroken('metrack-20260101T000000000Z.db');
    at('2026-11-15T04:30:00.000Z');
    images = [];
    expect((await backup().run()).prunedImages).toBe(0);
    expect(imageFiles()).toEqual(['aaa.webp']);
  });

  it('leaves no database and no partial file when the export fails', async () => {
    failure = new Error('export down');
    await expect(backup().run()).rejects.toThrow('export down');
    expect(databases()).toEqual([]);
  });

  it('leaves no database, no partial file and no half image when a download comes back short', async () => {
    images = ['aaa.webp', 'bbb.webp'];
    r2.put('aaa.webp');
    r2.put('bbb.webp');
    r2.corrupt.add('bbb.webp');
    await expect(backup().run()).rejects.toThrow('expected');
    expect(databases()).toEqual([]);
    expect(imageFiles()).toEqual(['aaa.webp']);
  });

  it('refuses an export that is not valid SQL without leaving files', async () => {
    failure = undefined;
    const broken = new CloudBackup(dir, 14, new FakeD1(() => 'THIS IS NOT SQL;'), r2, () => clock);
    await expect(broken.run()).rejects.toThrow();
    expect(databases()).toEqual([]);
  });

  it('ignores object keys that are not plain file names', async () => {
    images = ['aaa.webp'];
    r2.put('aaa.webp');
    r2.put('../escape.webp');
    await backup().run();
    expect(imageFiles()).toEqual(['aaa.webp']);
  });
});

function writeBroken(name: string): void {
  writeFileSync(join(dir, 'databases', name), 'not a database');
}
