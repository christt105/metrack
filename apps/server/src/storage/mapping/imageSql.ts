export const REVIEW_TABLES = [
  'movie_entry',
  'series_entry',
  'season_entry',
  'videogame_entry',
  'book_entry',
];

/** Selects one row when a shared, unowned catalog row shows the image ref in the given column. */
export function catalogShowsSql(table: string, column: string): string {
  const owner =
    table === 'season'
      ? 'series_id IN (SELECT id FROM series WHERE owner_id IS NULL)'
      : 'owner_id IS NULL';
  return `SELECT 1 FROM ${table} WHERE ${column} = ? AND ${owner} LIMIT 1`;
}
