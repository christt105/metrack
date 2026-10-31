import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackupService } from '../src/backup/BackupService.js';
import { ImageStore } from '../src/images/ImageStore.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { openDatabase } from '../src/storage/openDatabase.js';
import {
  BookRepository,
  MovieRepository,
  SeasonOverrideRepository,
  SeasonRepository,
  SeriesRepository,
  UnlinkedTitleRepository,
  VideogameRepository,
} from '../src/storage/repositories/index.js';
import { fakeFetch } from './support/fakeFetch.js';
import { png } from './support/sampleImages.js';

const tracking = {
  status: 'planned' as const,
  startedAt: null,
  finishedAt: null,
  rating: null,
  review: null,
  rewatches: [],
  pendingReview: false,
};

let dir: string;
let db: DatabaseSync;

function dump(database: DatabaseSync): string {
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  return JSON.stringify(
    tables.map(({ name }) => [name, database.prepare(`SELECT * FROM "${name}"`).all()]),
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'metrack-roundtrip-'));
  db = openDatabase(join(dir, 'metrack.db'));
  new MigrationRunner(db, migrations).run();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('backup and restore of the whole data directory', () => {
  it('restores every table and the image store exactly', async () => {
    const imageStore = new ImageStore(
      db,
      join(dir, 'images'),
      fakeFetch({ 'https://img.test/cover.png': png(20, 30) }).fetch,
    );
    const image = await imageStore.download('https://img.test/cover.png');

    const series = new SeriesRepository(db).create({
      tmdbId: 1,
      tvdbId: 2,
      jellyfinId: null,
      title: 'Lupin',
      originalTitle: null,
      firstAirDate: '2021-01-08',
      overview: null,
      genres: ['Crime'],
      cast: [],
      follow: true,
      note: null,
      cover: image.ref,
      banner: null,
      slug: null,
      tags: [],
      review: null,
    });
    new SeasonRepository(db).create({
      seriesId: series.id,
      number: 1,
      tmdbSeasonNumber: 1,
      jellyfinId: null,
      title: null,
      overview: null,
      firstAirDate: null,
      episodeCount: 5,
      cover: null,
      banner: null,
      slug: null,
      tags: [],
      ...tracking,
    });
    new SeasonOverrideRepository(db).set({
      seriesId: series.id,
      tmdbSeasonNumber: 1,
      number: 2,
      title: 'Part 2',
      jellyfinSeasonId: 'jf-s2',
    });
    new MovieRepository(db).create({
      tmdbId: 10,
      jellyfinId: null,
      title: 'Aftersun',
      originalTitle: null,
      releaseDate: null,
      overview: null,
      genres: [],
      cast: [],
      director: null,
      follow: false,
      note: null,
      cover: null,
      banner: null,
      slug: null,
      tags: ['drama'],
      ...tracking,
    });
    new VideogameRepository(db).create({
      igdbId: 1,
      steamAppId: '447150',
      steamGridDbId: null,
      title: 'Ape Out',
      releaseDate: null,
      overview: null,
      genres: [],
      developer: null,
      platforms: ['PC'],
      note: null,
      cover: null,
      banner: null,
      slug: null,
      tags: [],
      ...tracking,
    });
    new BookRepository(db).create({
      openLibraryId: 'OL1M',
      isbn: null,
      title: 'Book',
      authors: ['A'],
      publisher: null,
      pageCount: null,
      releaseDate: null,
      overview: null,
      genres: [],
      note: null,
      cover: null,
      slug: null,
      tags: [],
      ...tracking,
    });
    new UnlinkedTitleRepository(db).create({
      mediaType: 'series',
      title: 'Mystery',
      year: null,
      source: 'jellyfin',
      sourceRef: 'ref',
      createdAt: '2026-10-24T10:00:00.000Z',
    });

    const service = new BackupService(
      db,
      { dbPath: join(dir, 'metrack.db'), imagesDir: join(dir, 'images') },
      join(dir, 'backups'),
    );
    const before = dump(db);
    const imageFiles = readdirSync(join(dir, 'images')).sort();
    const imageBytes = readFileSync(join(dir, 'images', imageFiles[0]!));
    const backup = service.create();

    db.exec('DELETE FROM series; DELETE FROM movie; DELETE FROM image; DELETE FROM unlinked_title');
    rmSync(join(dir, 'images'), { recursive: true, force: true });
    db.close();
    const safetyDir = service.restore(backup.name);

    const restored = openDatabase(join(dir, 'metrack.db'));
    try {
      expect(dump(restored)).toBe(before);
      expect(readdirSync(join(dir, 'images')).sort()).toEqual(imageFiles);
      expect(readFileSync(join(dir, 'images', imageFiles[0]!))).toEqual(imageBytes);
      expect(existsSync(join(dir, 'backups', backup.name, 'images'))).toBe(true);
      const saved = openDatabase(join(safetyDir, 'metrack.db'));
      try {
        expect(saved.prepare('SELECT COUNT(*) AS n FROM series').get()).toEqual({ n: 0 });
        expect(saved.prepare('SELECT COUNT(*) AS n FROM videogame').get()).toEqual({ n: 1 });
      } finally {
        saved.close();
      }
      expect(existsSync(join(safetyDir, 'images'))).toBe(false);
    } finally {
      restored.close();
    }
  });
});
