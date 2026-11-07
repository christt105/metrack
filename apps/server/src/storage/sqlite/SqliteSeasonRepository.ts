import type { DatabaseSync } from 'node:sqlite';
import type { UserScope } from '../../users/UserScope.js';
import type { Season } from '@metrack/domain';
import type { SeasonRepository } from '../repositories/SeasonRepository.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';
import { SqliteTableRepository } from './SqliteTableRepository.js';
import { num, parseList, text, trackingFromRow, trackingToRow } from './rowMapping.js';

const ENTRY_COLUMNS = [
  'jellyfin_id',
  'slug',
  'tags',
  'status',
  'started_at',
  'finished_at',
  'rating',
  'review',
  'rewatches',
  'pending_review',
];

export class SqliteSeasonRepository
  extends SqliteTableRepository<Season>
  implements SeasonRepository
{
  constructor(db: DatabaseSync, scope: UserScope) {
    super(db, scope, 'season', ENTRY_COLUMNS, [['series_id', 'number']]);
  }

  async listBySeries(seriesId: number): Promise<Season[]> {
    return this.where('c.series_id = ? ORDER BY c.number', seriesId);
  }

  protected toRow(s: Omit<Season, 'id'>): RowValues {
    return {
      series_id: s.seriesId,
      number: s.number,
      tmdb_season_number: s.tmdbSeasonNumber,
      jellyfin_id: s.jellyfinId,
      title: s.title,
      overview: s.overview,
      first_air_date: s.firstAirDate,
      episode_count: s.episodeCount,
      cover: s.cover,
      banner: s.banner,
      slug: s.slug,
      tags: JSON.stringify(s.tags),
      ...trackingToRow(s),
    };
  }

  protected fromRow(row: Row): Season {
    return {
      id: Number(row.id),
      seriesId: Number(row.series_id),
      number: Number(row.number),
      tmdbSeasonNumber: num(row.tmdb_season_number),
      jellyfinId: text(row.jellyfin_id),
      title: text(row.title),
      overview: text(row.overview),
      firstAirDate: text(row.first_air_date),
      episodeCount: num(row.episode_count),
      cover: text(row.cover),
      banner: text(row.banner),
      slug: text(row.slug),
      tags: parseList(row.tags),
      ...trackingFromRow(row),
    };
  }
}
