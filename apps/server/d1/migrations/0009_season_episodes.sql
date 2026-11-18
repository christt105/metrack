CREATE TABLE season_episodes (
  season_id INTEGER PRIMARY KEY REFERENCES season (id) ON DELETE CASCADE,
  episodes TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL CHECK (source IN ('tmdb','jellyfin')),
  fetched_at TEXT NOT NULL,
  complete INTEGER NOT NULL DEFAULT 1 CHECK (complete IN (0, 1))
);

CREATE TABLE series_episode_entry (
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  series_id INTEGER NOT NULL REFERENCES series (id) ON DELETE CASCADE,
  watched TEXT NOT NULL DEFAULT '{}',
  skipped TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, series_id)
);

CREATE INDEX series_episode_entry_series ON series_episode_entry (series_id);

ALTER TABLE season_entry ADD COLUMN watched_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE season_entry ADD COLUMN skipped_count INTEGER NOT NULL DEFAULT 0;

UPDATE season_entry SET watched_count = COALESCE((SELECT episode_count FROM season WHERE season.id = season_entry.season_id), 0) WHERE status = 'completed';
