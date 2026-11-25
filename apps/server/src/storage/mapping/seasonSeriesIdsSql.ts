export const SEASON_SERIES_IDS_SQL = `SELECT DISTINCT c.series_id FROM season_entry e
  JOIN season c ON c.id = e.season_id WHERE e.user_id = ? ORDER BY c.series_id`;
