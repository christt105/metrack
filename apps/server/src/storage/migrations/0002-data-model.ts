import type { Migration } from '../Migration.js';

export const dataModelMigration: Migration = {
  version: 2,
  name: 'data-model',
  up: (db) => {
    db.exec(`
      CREATE TABLE movie (
        id INTEGER PRIMARY KEY,
        tmdb_id INTEGER UNIQUE,
        jellyfin_id TEXT UNIQUE,
        title TEXT NOT NULL,
        original_title TEXT,
        release_date TEXT,
        overview TEXT,
        genres TEXT NOT NULL DEFAULT '[]',
        cast_members TEXT NOT NULL DEFAULT '[]',
        director TEXT,
        note TEXT,
        cover TEXT,
        banner TEXT,
        status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','paused','dropped','completed')),
        started_at TEXT,
        finished_at TEXT,
        rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
        review TEXT,
        rewatches TEXT NOT NULL DEFAULT '[]',
        fetched_at TEXT,
        metadata_hash TEXT,
        edited_fields TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE series (
        id INTEGER PRIMARY KEY,
        tmdb_id INTEGER UNIQUE,
        tvdb_id INTEGER UNIQUE,
        jellyfin_id TEXT UNIQUE,
        title TEXT NOT NULL,
        original_title TEXT,
        first_air_date TEXT,
        overview TEXT,
        genres TEXT NOT NULL DEFAULT '[]',
        cast_members TEXT NOT NULL DEFAULT '[]',
        follow INTEGER NOT NULL DEFAULT 0 CHECK (follow IN (0, 1)),
        note TEXT,
        cover TEXT,
        banner TEXT,
        fetched_at TEXT,
        metadata_hash TEXT,
        edited_fields TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE season (
        id INTEGER PRIMARY KEY,
        series_id INTEGER NOT NULL REFERENCES series (id) ON DELETE CASCADE,
        number INTEGER NOT NULL,
        tmdb_season_number INTEGER,
        jellyfin_id TEXT UNIQUE,
        title TEXT,
        overview TEXT,
        first_air_date TEXT,
        episode_count INTEGER,
        cover TEXT,
        banner TEXT,
        status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','paused','dropped','completed')),
        started_at TEXT,
        finished_at TEXT,
        rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
        review TEXT,
        rewatches TEXT NOT NULL DEFAULT '[]',
        fetched_at TEXT,
        metadata_hash TEXT,
        edited_fields TEXT NOT NULL DEFAULT '[]',
        UNIQUE (series_id, number)
      );

      CREATE TABLE season_override (
        series_id INTEGER NOT NULL REFERENCES series (id) ON DELETE CASCADE,
        tmdb_season_number INTEGER NOT NULL,
        number INTEGER,
        title TEXT,
        jellyfin_season_id TEXT,
        PRIMARY KEY (series_id, tmdb_season_number)
      );

      CREATE TABLE videogame (
        id INTEGER PRIMARY KEY,
        igdb_id INTEGER UNIQUE,
        steam_appid TEXT,
        steamgriddb_id INTEGER,
        title TEXT NOT NULL,
        release_date TEXT,
        overview TEXT,
        genres TEXT NOT NULL DEFAULT '[]',
        developer TEXT,
        platforms TEXT NOT NULL DEFAULT '[]',
        note TEXT,
        cover TEXT,
        banner TEXT,
        status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','paused','dropped','completed')),
        started_at TEXT,
        finished_at TEXT,
        rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
        review TEXT,
        rewatches TEXT NOT NULL DEFAULT '[]',
        fetched_at TEXT,
        metadata_hash TEXT,
        edited_fields TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE book (
        id INTEGER PRIMARY KEY,
        openlibrary_id TEXT UNIQUE,
        isbn TEXT,
        title TEXT NOT NULL,
        authors TEXT NOT NULL DEFAULT '[]',
        publisher TEXT,
        page_count INTEGER,
        release_date TEXT,
        overview TEXT,
        genres TEXT NOT NULL DEFAULT '[]',
        note TEXT,
        cover TEXT,
        status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','paused','dropped','completed')),
        started_at TEXT,
        finished_at TEXT,
        rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
        review TEXT,
        rewatches TEXT NOT NULL DEFAULT '[]',
        fetched_at TEXT,
        metadata_hash TEXT,
        edited_fields TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE unlinked_title (
        id INTEGER PRIMARY KEY,
        media_type TEXT NOT NULL CHECK (media_type IN ('movie','series','season','videogame','book')),
        title TEXT NOT NULL,
        year INTEGER,
        source TEXT NOT NULL,
        source_ref TEXT,
        created_at TEXT NOT NULL
      );
    `);
  },
};
