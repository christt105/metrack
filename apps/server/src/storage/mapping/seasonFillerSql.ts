import type { FillerCategory } from '@metrack/domain';
import type { SeasonFiller } from '../repositories/SeasonFiller.js';
import type { Row } from './Row.js';
import type { SqlValue } from './SqlValue.js';

const CATEGORIES: readonly string[] = ['filler', 'mixed', 'mangaCanon', 'animeCanon'];

export const SELECT_SEASON_FILLER_SQL = 'SELECT * FROM season_filler WHERE season_id = ?';

export const DELETE_SERIES_FILLER_SQL =
  'DELETE FROM season_filler WHERE season_id IN (SELECT id FROM season WHERE series_id = ?)';

export const INSERT_SEASON_FILLER_SQL =
  'INSERT INTO season_filler (season_id, slug, categories) VALUES (?, ?, ?)';

export function seasonFillerFromRow(row: Row): SeasonFiller {
  const categories: Record<string, FillerCategory> = {};
  const parsed: unknown = JSON.parse(String(row.categories));
  if (typeof parsed === 'object' && parsed !== null) {
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && CATEGORIES.includes(value)) {
        categories[key] = value as FillerCategory;
      }
    }
  }
  return { seasonId: Number(row.season_id), slug: String(row.slug), categories };
}

export function seasonFillerToRow(filler: SeasonFiller): SqlValue[] {
  return [filler.seasonId, filler.slug, JSON.stringify(filler.categories)];
}
