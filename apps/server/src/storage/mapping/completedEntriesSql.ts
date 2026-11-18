export const COMPLETED_ENTRIES_SQL = `SELECT e.user_id, e.status, e.started_at, e.finished_at, e.rewatches, w.watched, w.skipped
  FROM season_entry e
  JOIN series_episode_entry w ON w.user_id = e.user_id AND w.series_id = (SELECT s.series_id FROM season s WHERE s.id = e.season_id)
  WHERE e.season_id = ? AND e.status = 'completed'`;

export const REOPEN_ENTRY_SQL =
  "UPDATE season_entry SET status = 'in_progress', finished_at = NULL WHERE season_id = ? AND user_id = ? AND status = 'completed'";
