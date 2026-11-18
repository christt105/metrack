export const UPSERT_WATCHES_SQL = `INSERT INTO series_episode_entry (user_id, series_id, watched) VALUES (?, ?, ?)
  ON CONFLICT (user_id, series_id) DO UPDATE SET watched = excluded.watched`;

export const UPSERT_CATALOG_SQL = `INSERT INTO season_episodes (season_id, episodes, source, fetched_at, complete) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (season_id) DO UPDATE SET episodes = excluded.episodes, source = excluded.source, fetched_at = excluded.fetched_at, complete = excluded.complete`;

export const DELETE_SERIES_CATALOGS_SQL =
  'DELETE FROM season_episodes WHERE season_id IN (SELECT id FROM season WHERE series_id = ?)';
