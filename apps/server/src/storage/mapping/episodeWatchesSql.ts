export const UPSERT_WATCHES_SQL = `INSERT INTO season_episode_entry (user_id, season_id, watched) VALUES (?, ?, ?)
  ON CONFLICT (user_id, season_id) DO UPDATE SET watched = excluded.watched`;

export const UPDATE_WATCHED_COUNT_SQL =
  'UPDATE season_entry SET watched_count = ? WHERE user_id = ? AND season_id = ?';

export const UPDATE_TRACKING_SQL =
  'UPDATE season_entry SET watched_count = ?, status = ?, started_at = ?, finished_at = ?, rewatches = ? WHERE user_id = ? AND season_id = ?';

export const UPSERT_CATALOG_SQL = `INSERT INTO season_episodes (season_id, episodes, source, fetched_at) VALUES (?, ?, ?, ?)
  ON CONFLICT (season_id) DO UPDATE SET episodes = excluded.episodes, source = excluded.source, fetched_at = excluded.fetched_at`;
