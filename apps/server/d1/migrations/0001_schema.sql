-- metrack schema 18 (TypeScript migrations 0001..0018).

CREATE TABLE api_token (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  secret_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL CHECK (scope IN ('read', 'write')),
  created_at TEXT NOT NULL,
  expires_at TEXT,
  last_used_at TEXT
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
  cover TEXT,
  fetched_at TEXT,
  metadata_hash TEXT,
  owner_id INTEGER REFERENCES user (id) ON DELETE CASCADE
);

CREATE TABLE book_entry (
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES book (id) ON DELETE CASCADE,
  note TEXT,
  slug TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','paused','dropped','completed')),
  started_at TEXT,
  finished_at TEXT,
  rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  review TEXT,
  rewatches TEXT NOT NULL DEFAULT '[]',
  pending_review INTEGER NOT NULL DEFAULT 0 CHECK (pending_review IN (0, 1)),
  overrides TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, book_id)
);

CREATE TABLE image (
  hash TEXT PRIMARY KEY,
  extension TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  byte_size INTEGER NOT NULL,
  source_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE image_owner (
  hash TEXT NOT NULL REFERENCES image (hash) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (hash, user_id)
);

CREATE TABLE image_source (
  url TEXT PRIMARY KEY,
  hash TEXT NOT NULL REFERENCES image (hash) ON DELETE CASCADE
);

CREATE TABLE movie (
  id INTEGER PRIMARY KEY,
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
  metadata_hash TEXT,
  owner_id INTEGER REFERENCES user (id) ON DELETE CASCADE
);

CREATE TABLE movie_entry (
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL REFERENCES movie (id) ON DELETE CASCADE,
  jellyfin_id TEXT,
  follow INTEGER NOT NULL DEFAULT 0 CHECK (follow IN (0, 1)),
  note TEXT,
  slug TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','paused','dropped','completed')),
  started_at TEXT,
  finished_at TEXT,
  rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  review TEXT,
  rewatches TEXT NOT NULL DEFAULT '[]',
  pending_review INTEGER NOT NULL DEFAULT 0 CHECK (pending_review IN (0, 1)),
  overrides TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, movie_id),
  UNIQUE (user_id, jellyfin_id)
);

CREATE TABLE release_alert (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('movie', 'season')),
  subject_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('releases_tomorrow', 'releases_today', 'available_es')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  UNIQUE (user_id, subject_type, subject_id, kind)
);

CREATE TABLE season (
  id INTEGER PRIMARY KEY,
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
  UNIQUE (series_id, number)
);

CREATE TABLE season_entry (
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL REFERENCES season (id) ON DELETE CASCADE,
  jellyfin_id TEXT,
  slug TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','paused','dropped','completed')),
  started_at TEXT,
  finished_at TEXT,
  rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  review TEXT,
  rewatches TEXT NOT NULL DEFAULT '[]',
  pending_review INTEGER NOT NULL DEFAULT 0 CHECK (pending_review IN (0, 1)),
  overrides TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, season_id),
  UNIQUE (user_id, jellyfin_id)
);

CREATE TABLE season_override (
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  series_id INTEGER NOT NULL REFERENCES series (id) ON DELETE CASCADE,
  tmdb_season_number INTEGER NOT NULL,
  number INTEGER,
  title TEXT,
  jellyfin_season_id TEXT,
  PRIMARY KEY (user_id, series_id, tmdb_season_number)
);

CREATE TABLE series (
  id INTEGER PRIMARY KEY,
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
  metadata_hash TEXT,
  owner_id INTEGER REFERENCES user (id) ON DELETE CASCADE
);

CREATE TABLE series_entry (
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  series_id INTEGER NOT NULL REFERENCES series (id) ON DELETE CASCADE,
  jellyfin_id TEXT,
  follow INTEGER NOT NULL DEFAULT 0 CHECK (follow IN (0, 1)),
  note TEXT,
  slug TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  review TEXT,
  overrides TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, series_id),
  UNIQUE (user_id, jellyfin_id)
);

CREATE TABLE session (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE unlinked_title (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie','series','season','videogame','book')),
  title TEXT NOT NULL,
  year INTEGER,
  source TEXT NOT NULL,
  source_ref TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE user (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'normal'
    CHECK (role IN ('owner', 'trusted', 'normal')),
  handle TEXT,
  deletion_requested_at TEXT
);

CREATE TABLE user_setting (
  user_id INTEGER PRIMARY KEY REFERENCES user (id) ON DELETE CASCADE,
  jellyfin_user TEXT,
  ntfy_topic TEXT,
  publish_project TEXT,
  publish_base_url TEXT,
  mirror_dir TEXT,
  mirror_link_prefix TEXT,
  public_page INTEGER NOT NULL DEFAULT 0,
  public_avatar TEXT,
  public_intro TEXT,
  public_description TEXT,
  public_about TEXT,
  giscus_repo TEXT,
  giscus_repo_id TEXT,
  giscus_category TEXT,
  giscus_category_id TEXT
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
  cover TEXT,
  banner TEXT,
  fetched_at TEXT,
  metadata_hash TEXT,
  owner_id INTEGER REFERENCES user (id) ON DELETE CASCADE
);

CREATE TABLE videogame_entry (
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  videogame_id INTEGER NOT NULL REFERENCES videogame (id) ON DELETE CASCADE,
  note TEXT,
  slug TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','paused','dropped','completed')),
  started_at TEXT,
  finished_at TEXT,
  rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  review TEXT,
  rewatches TEXT NOT NULL DEFAULT '[]',
  pending_review INTEGER NOT NULL DEFAULT 0 CHECK (pending_review IN (0, 1)),
  overrides TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, videogame_id)
);

CREATE INDEX api_token_user ON api_token (user_id);
CREATE INDEX book_cover ON book (cover);
CREATE INDEX book_entry_catalog ON book_entry (book_id);
CREATE INDEX book_owner ON book (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX image_owner_user ON image_owner (user_id);
CREATE INDEX image_source_hash ON image_source (hash);
CREATE INDEX image_source_url ON image (source_url);
CREATE INDEX movie_banner ON movie (banner);
CREATE INDEX movie_cover ON movie (cover);
CREATE INDEX movie_entry_catalog ON movie_entry (movie_id);
CREATE INDEX movie_owner ON movie (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX release_alert_user_sent ON release_alert (user_id, sent_at DESC, id DESC);
CREATE INDEX season_banner ON season (banner);
CREATE INDEX season_cover ON season (cover);
CREATE INDEX season_entry_catalog ON season_entry (season_id);
CREATE INDEX season_override_series ON season_override (series_id);
CREATE INDEX series_banner ON series (banner);
CREATE INDEX series_cover ON series (cover);
CREATE INDEX series_entry_catalog ON series_entry (series_id);
CREATE INDEX series_owner ON series (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX session_expires ON session (expires_at);
CREATE INDEX session_user ON session (user_id);
CREATE INDEX unlinked_title_user ON unlinked_title (user_id);
CREATE INDEX user_deletion ON user (deletion_requested_at) WHERE deletion_requested_at IS NOT NULL;
CREATE UNIQUE INDEX user_handle ON user (handle COLLATE NOCASE) WHERE handle IS NOT NULL;
CREATE INDEX videogame_banner ON videogame (banner);
CREATE INDEX videogame_cover ON videogame (cover);
CREATE INDEX videogame_entry_catalog ON videogame_entry (videogame_id);
CREATE INDEX videogame_owner ON videogame (owner_id) WHERE owner_id IS NOT NULL;
