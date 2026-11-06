import type { DatabaseSync } from 'node:sqlite';
import type { Migration } from '../Migration.js';

const TRACKING = `status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','paused','dropped','completed')),
        started_at TEXT,
        finished_at TEXT,
        rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
        review TEXT,
        rewatches TEXT NOT NULL DEFAULT '[]',
        pending_review INTEGER NOT NULL DEFAULT 0 CHECK (pending_review IN (0, 1)),`;

const OWNER = 'user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,';

const TABLES: { name: string; ddl: string }[] = [
  {
    name: 'movie_entry',
    ddl: `${OWNER}
        movie_id INTEGER NOT NULL REFERENCES movie (id) ON DELETE CASCADE,
        jellyfin_id TEXT,
        follow INTEGER NOT NULL DEFAULT 0 CHECK (follow IN (0, 1)),
        note TEXT,
        slug TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        ${TRACKING}
        overrides TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (user_id, movie_id),
        UNIQUE (user_id, jellyfin_id)`,
  },
  {
    name: 'series_entry',
    ddl: `${OWNER}
        series_id INTEGER NOT NULL REFERENCES series (id) ON DELETE CASCADE,
        jellyfin_id TEXT,
        follow INTEGER NOT NULL DEFAULT 0 CHECK (follow IN (0, 1)),
        note TEXT,
        slug TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        review TEXT,
        overrides TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (user_id, series_id),
        UNIQUE (user_id, jellyfin_id)`,
  },
  {
    name: 'season_entry',
    ddl: `${OWNER}
        season_id INTEGER NOT NULL REFERENCES season (id) ON DELETE CASCADE,
        jellyfin_id TEXT,
        slug TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        ${TRACKING}
        overrides TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (user_id, season_id),
        UNIQUE (user_id, jellyfin_id)`,
  },
  {
    name: 'videogame_entry',
    ddl: `${OWNER}
        videogame_id INTEGER NOT NULL REFERENCES videogame (id) ON DELETE CASCADE,
        note TEXT,
        slug TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        ${TRACKING}
        overrides TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (user_id, videogame_id)`,
  },
  {
    name: 'book_entry',
    ddl: `${OWNER}
        book_id INTEGER NOT NULL REFERENCES book (id) ON DELETE CASCADE,
        note TEXT,
        slug TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        ${TRACKING}
        overrides TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (user_id, book_id)`,
  },
  {
    name: 'season_override',
    ddl: `${OWNER}
        series_id INTEGER NOT NULL REFERENCES series (id) ON DELETE CASCADE,
        tmdb_season_number INTEGER NOT NULL,
        number INTEGER,
        title TEXT,
        jellyfin_season_id TEXT,
        PRIMARY KEY (user_id, series_id, tmdb_season_number)`,
  },
  {
    name: 'unlinked_title',
    ddl: `id INTEGER PRIMARY KEY,
        ${OWNER}
        media_type TEXT NOT NULL CHECK (media_type IN ('movie','series','season','videogame','book')),
        title TEXT NOT NULL,
        year INTEGER,
        source TEXT NOT NULL,
        source_ref TEXT,
        created_at TEXT NOT NULL`,
  },
  {
    name: 'release_alert',
    ddl: `id INTEGER PRIMARY KEY,
        ${OWNER}
        subject_type TEXT NOT NULL CHECK (subject_type IN ('movie', 'season')),
        subject_id INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('releases_tomorrow', 'releases_today', 'available_es')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        UNIQUE (user_id, subject_type, subject_id, kind)`,
  },
];

function addOwner(db: DatabaseSync, table: { name: string; ddl: string }): void {
  const columns = db
    .prepare(`SELECT name FROM pragma_table_info('${table.name}') ORDER BY cid`)
    .all()
    .map((row) => String(row.name));
  db.exec(`CREATE TABLE ${table.name}_owned (
        ${table.ddl}
      )`);
  db.exec(
    `INSERT INTO ${table.name}_owned (user_id, ${columns.join(', ')})
     SELECT 1, ${columns.join(', ')} FROM ${table.name}`,
  );
  db.exec(`DROP TABLE ${table.name}`);
  db.exec(`ALTER TABLE ${table.name}_owned RENAME TO ${table.name}`);
}

/**
 * Gives every personal row an owner: the entries, the season overrides of a series, the unlinked inbox and the
 * sent release alerts. Everything stored so far goes to user 1. Uniqueness that was global (a Jellyfin id, an
 * alert per subject and kind) becomes per user; the catalog stays shared.
 */
export const dataOwnersMigration: Migration = {
  version: 11,
  name: 'data-owners',
  rebuildsTables: true,
  up: (db) => {
    for (const table of TABLES) addOwner(db, table);
    for (const media of ['movie', 'series', 'season', 'videogame', 'book']) {
      db.exec(`CREATE INDEX ${media}_entry_catalog ON ${media}_entry (${media}_id)`);
    }
    db.exec('CREATE INDEX unlinked_title_user ON unlinked_title (user_id)');
  },
};
