export const UPSERT_WATCHES_SQL = `INSERT INTO series_episode_entry (user_id, series_id, watched, skipped) VALUES (?, ?, ?, ?)
  ON CONFLICT (user_id, series_id) DO UPDATE SET watched = excluded.watched, skipped = excluded.skipped`;

export const UPSERT_UNMATCHED_SQL = `INSERT INTO series_episode_entry (user_id, series_id, unmatched) VALUES (?, ?, ?)
  ON CONFLICT (user_id, series_id) DO UPDATE SET unmatched = excluded.unmatched`;

export const UPSERT_WATCHES_KEEP_SKIPPED_SQL = `INSERT INTO series_episode_entry (user_id, series_id, watched) VALUES (?, ?, ?)
  ON CONFLICT (user_id, series_id) DO UPDATE SET watched = excluded.watched`;

export const UPDATE_WATCHED_COUNT_SQL =
  'UPDATE season_entry SET watched_count = ? WHERE user_id = ? AND season_id = ?';

export const UPDATE_TRACKING_SQL =
  'UPDATE season_entry SET watched_count = ?, skipped_count = ?, status = ?, started_at = ?, finished_at = ?, rewatches = ? WHERE user_id = ? AND season_id = ?';

export const UPSERT_CATALOG_SQL = `INSERT INTO season_episodes (season_id, episodes, source, fetched_at, complete, refill) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (season_id) DO UPDATE SET episodes = excluded.episodes, source = excluded.source, fetched_at = excluded.fetched_at, complete = excluded.complete, refill = excluded.refill`;

export const DELETE_SERIES_CATALOGS_SQL =
  'DELETE FROM season_episodes WHERE season_id IN (SELECT id FROM season WHERE series_id = ?)';

export const SELECT_USER_CATALOGS_SQL =
  'SELECT * FROM season_episodes WHERE season_id IN (SELECT season_id FROM season_entry WHERE user_id = ?) ORDER BY season_id';

export const SELECT_SERIES_CATALOGS_SQL =
  'SELECT * FROM season_episodes WHERE season_id IN (SELECT id FROM season WHERE series_id = ?) ORDER BY season_id';
