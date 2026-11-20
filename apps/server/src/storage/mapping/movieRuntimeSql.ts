export const SELECT_MISSING_RUNTIME_SQL =
  'SELECT id, tmdb_id FROM movie WHERE runtime IS NULL AND tmdb_id IS NOT NULL ORDER BY id LIMIT ?';

export const SET_RUNTIME_SQL = 'UPDATE movie SET runtime = ? WHERE id = ?';
