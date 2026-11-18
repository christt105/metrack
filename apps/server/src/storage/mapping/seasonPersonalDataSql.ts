export const SEASON_PERSONAL_DATA_SQL = `SELECT 1 FROM season_entry WHERE season_id = ? AND (
  status <> 'planned' OR rating IS NOT NULL OR review IS NOT NULL OR rewatches <> '[]'
  OR started_at IS NOT NULL OR finished_at IS NOT NULL OR tags <> '[]' OR overrides <> '{}'
) LIMIT 1`;
