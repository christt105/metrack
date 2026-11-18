export const SEASON_PERSONAL_DATA_SQL = `SELECT 1 FROM season_entry e WHERE e.season_id = ? AND (
  e.rating IS NOT NULL OR e.review IS NOT NULL OR e.tags <> '[]' OR e.overrides <> '{}'
  OR (
    (e.status <> 'planned' OR e.rewatches <> '[]' OR e.started_at IS NOT NULL OR e.finished_at IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM series_episode_entry w, json_each(w.watched) k
      WHERE w.user_id = e.user_id
        AND w.series_id = (SELECT s.series_id FROM season s WHERE s.id = e.season_id)
        AND k.key IN (SELECT value FROM json_each(?))
    )
  )
) LIMIT 1`;
