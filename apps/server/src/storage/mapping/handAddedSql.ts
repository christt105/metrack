import type { CatalogCollection } from '@metrack/domain';

export const HAND_ADDED_TABLES: Record<CatalogCollection, string> = {
  movies: 'movie',
  series: 'series',
  games: 'videogame',
  books: 'book',
};

/** The condition that no user has an entry for the catalog row of the table. */
export function unreferencedSql(table: string): string {
  const own = `NOT EXISTS (SELECT 1 FROM ${table}_entry WHERE ${table}_id = ${table}.id)`;
  if (table !== 'series') return own;
  return `${own} AND NOT EXISTS (
    SELECT 1 FROM season_entry WHERE season_id IN (SELECT id FROM season WHERE series_id = series.id)
  )`;
}
