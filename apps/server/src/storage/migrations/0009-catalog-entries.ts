import type { DatabaseSync } from 'node:sqlite';
import type { Migration } from '../Migration.js';

const TRACKING = `status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','paused','dropped','completed')),
        started_at TEXT,
        finished_at TEXT,
        rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
        review TEXT,
        rewatches TEXT NOT NULL DEFAULT '[]',
        pending_review INTEGER NOT NULL DEFAULT 0 CHECK (pending_review IN (0, 1)),`;

const TRACKING_COLUMNS = [
  'status',
  'started_at',
  'finished_at',
  'rating',
  'review',
  'rewatches',
  'pending_review',
];

const LIST_COLUMNS = new Set(['genres', 'cast_members', 'platforms', 'authors']);

const FIELD_COLUMNS: Record<string, string> = {
  title: 'title',
  originalTitle: 'original_title',
  releaseDate: 'release_date',
  firstAirDate: 'first_air_date',
  overview: 'overview',
  genres: 'genres',
  cast: 'cast_members',
  director: 'director',
  episodeCount: 'episode_count',
  developer: 'developer',
  platforms: 'platforms',
  authors: 'authors',
  publisher: 'publisher',
  pageCount: 'page_count',
  cover: 'cover',
  banner: 'banner',
};

interface Split {
  table: string;
  catalogDdl: string;
  catalogColumns: string[];
  entryDdl: string;
  entryColumns: string[];
}

const SPLITS: Split[] = [
  {
    table: 'movie',
    catalogDdl: `id INTEGER PRIMARY KEY,
        tmdb_id INTEGER UNIQUE,
        title TEXT NOT NULL,
        original_title TEXT,
        release_date TEXT,
        overview TEXT,
        genres TEXT NOT NULL DEFAULT '[]',
        cast_members TEXT NOT NULL DEFAULT '[]',
        director TEXT,
        cover TEXT,
        banner TEXT,
        fetched_at TEXT,
        metadata_hash TEXT`,
    catalogColumns: [
      'id',
      'tmdb_id',
      'title',
      'original_title',
      'release_date',
      'overview',
      'genres',
      'cast_members',
      'director',
      'cover',
      'banner',
      'fetched_at',
      'metadata_hash',
    ],
    entryDdl: `movie_id INTEGER PRIMARY KEY REFERENCES movie (id) ON DELETE CASCADE,
        jellyfin_id TEXT UNIQUE,
        follow INTEGER NOT NULL DEFAULT 0 CHECK (follow IN (0, 1)),
        note TEXT,
        slug TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        ${TRACKING}`,
    entryColumns: ['jellyfin_id', 'follow', 'note', 'slug', 'tags', ...TRACKING_COLUMNS],
  },
  {
    table: 'series',
    catalogDdl: `id INTEGER PRIMARY KEY,
        tmdb_id INTEGER UNIQUE,
        tvdb_id INTEGER UNIQUE,
        title TEXT NOT NULL,
        original_title TEXT,
        first_air_date TEXT,
        overview TEXT,
        genres TEXT NOT NULL DEFAULT '[]',
        cast_members TEXT NOT NULL DEFAULT '[]',
        cover TEXT,
        banner TEXT,
        fetched_at TEXT,
        metadata_hash TEXT`,
    catalogColumns: [
      'id',
      'tmdb_id',
      'tvdb_id',
      'title',
      'original_title',
      'first_air_date',
      'overview',
      'genres',
      'cast_members',
      'cover',
      'banner',
      'fetched_at',
      'metadata_hash',
    ],
    entryDdl: `series_id INTEGER PRIMARY KEY REFERENCES series (id) ON DELETE CASCADE,
        jellyfin_id TEXT UNIQUE,
        follow INTEGER NOT NULL DEFAULT 0 CHECK (follow IN (0, 1)),
        note TEXT,
        slug TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        review TEXT,`,
    entryColumns: ['jellyfin_id', 'follow', 'note', 'slug', 'tags', 'review'],
  },
  {
    table: 'season',
    catalogDdl: `id INTEGER PRIMARY KEY,
        series_id INTEGER NOT NULL REFERENCES series (id) ON DELETE CASCADE,
        number INTEGER NOT NULL,
        tmdb_season_number INTEGER,
        title TEXT,
        overview TEXT,
        first_air_date TEXT,
        episode_count INTEGER,
        cover TEXT,
        banner TEXT,
        fetched_at TEXT,
        metadata_hash TEXT,
        UNIQUE (series_id, number)`,
    catalogColumns: [
      'id',
      'series_id',
      'number',
      'tmdb_season_number',
      'title',
      'overview',
      'first_air_date',
      'episode_count',
      'cover',
      'banner',
      'fetched_at',
      'metadata_hash',
    ],
    entryDdl: `season_id INTEGER PRIMARY KEY REFERENCES season (id) ON DELETE CASCADE,
        jellyfin_id TEXT UNIQUE,
        slug TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        ${TRACKING}`,
    entryColumns: ['jellyfin_id', 'slug', 'tags', ...TRACKING_COLUMNS],
  },
  {
    table: 'videogame',
    catalogDdl: `id INTEGER PRIMARY KEY,
        igdb_id INTEGER UNIQUE,
        steam_appid TEXT,
        steamgriddb_id INTEGER,
        title TEXT NOT NULL,
        release_date TEXT,
        overview TEXT,
        genres TEXT NOT NULL DEFAULT '[]',
        developer TEXT,
        platforms TEXT NOT NULL DEFAULT '[]',
        cover TEXT,
        banner TEXT,
        fetched_at TEXT,
        metadata_hash TEXT`,
    catalogColumns: [
      'id',
      'igdb_id',
      'steam_appid',
      'steamgriddb_id',
      'title',
      'release_date',
      'overview',
      'genres',
      'developer',
      'platforms',
      'cover',
      'banner',
      'fetched_at',
      'metadata_hash',
    ],
    entryDdl: `videogame_id INTEGER PRIMARY KEY REFERENCES videogame (id) ON DELETE CASCADE,
        note TEXT,
        slug TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        ${TRACKING}`,
    entryColumns: ['note', 'slug', 'tags', ...TRACKING_COLUMNS],
  },
  {
    table: 'book',
    catalogDdl: `id INTEGER PRIMARY KEY,
        openlibrary_id TEXT UNIQUE,
        isbn TEXT,
        title TEXT NOT NULL,
        authors TEXT NOT NULL DEFAULT '[]',
        publisher TEXT,
        page_count INTEGER,
        release_date TEXT,
        overview TEXT,
        genres TEXT NOT NULL DEFAULT '[]',
        cover TEXT,
        fetched_at TEXT,
        metadata_hash TEXT`,
    catalogColumns: [
      'id',
      'openlibrary_id',
      'isbn',
      'title',
      'authors',
      'publisher',
      'page_count',
      'release_date',
      'overview',
      'genres',
      'cover',
      'fetched_at',
      'metadata_hash',
    ],
    entryDdl: `book_id INTEGER PRIMARY KEY REFERENCES book (id) ON DELETE CASCADE,
        note TEXT,
        slug TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        ${TRACKING}`,
    entryColumns: ['note', 'slug', 'tags', ...TRACKING_COLUMNS],
  },
];

function overridesOf(row: Record<string, unknown>): string {
  const edited = JSON.parse(String(row.edited_fields)) as string[];
  const overrides: Record<string, unknown> = {};
  for (const field of edited) {
    const column = FIELD_COLUMNS[field];
    if (column === undefined || !(column in row)) continue;
    const value = row[column];
    overrides[field] = LIST_COLUMNS.has(column) ? JSON.parse(String(value)) : value;
  }
  return JSON.stringify(overrides);
}

function split(db: DatabaseSync, s: Split): void {
  const entryTable = `${s.table}_entry`;
  const key = `${s.table}_id`;
  db.exec(`CREATE TABLE ${entryTable} (
        ${s.entryDdl}
        overrides TEXT NOT NULL DEFAULT '{}'
      )`);
  const insert = db.prepare(
    `INSERT INTO ${entryTable} (${[key, ...s.entryColumns, 'overrides'].join(', ')})
     VALUES (${[key, ...s.entryColumns, 'overrides'].map(() => '?').join(', ')})`,
  );
  for (const row of db.prepare(`SELECT * FROM ${s.table} ORDER BY id`).all()) {
    insert.run(
      Number(row.id),
      ...s.entryColumns.map((column) => row[column] as string | number | null),
      overridesOf(row),
    );
  }
  db.exec(`CREATE TABLE ${s.table}_catalog (
        ${s.catalogDdl}
      )`);
  db.exec(
    `INSERT INTO ${s.table}_catalog (${s.catalogColumns.join(', ')})
     SELECT ${s.catalogColumns.join(', ')} FROM ${s.table}`,
  );
}

/**
 * Splits every media table into a catalog row (what providers describe) and a personal entry (tracking, notes,
 * slug, tags, Jellyfin link and hand edits). Hand-edited fields move from `edited_fields` into the entry's
 * `overrides`, keeping their current value; the catalog keeps that value too until the next refresh.
 */
export const catalogEntriesMigration: Migration = {
  version: 9,
  name: 'catalog-entries',
  rebuildsTables: true,
  up: (db) => {
    for (const s of SPLITS) split(db, s);
    for (const s of SPLITS) {
      db.exec(`DROP TABLE ${s.table}`);
      db.exec(`ALTER TABLE ${s.table}_catalog RENAME TO ${s.table}`);
    }
  },
};
