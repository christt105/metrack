import type { DatabaseSync } from 'node:sqlite';
import type { UserScope } from '../../users/UserScope.js';
import type { Series } from '@metrack/domain';
import type { SeriesRepository } from '../repositories/SeriesRepository.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';
import { SqliteTableRepository } from './SqliteTableRepository.js';
import { num, parseList, text } from './rowMapping.js';

const ENTRY_COLUMNS = ['jellyfin_id', 'follow', 'note', 'slug', 'tags', 'review'];

const RELATED_DELETES = [
  'DELETE FROM season_entry WHERE user_id = ? AND season_id IN (SELECT id FROM season WHERE series_id = ?)',
  'DELETE FROM season_override WHERE user_id = ? AND series_id = ?',
];

export class SqliteSeriesRepository
  extends SqliteTableRepository<Series>
  implements SeriesRepository
{
  constructor(db: DatabaseSync, scope: UserScope) {
    super(db, scope, 'series', ENTRY_COLUMNS, [['tmdb_id'], ['tvdb_id']], RELATED_DELETES);
  }

  async findByTmdbId(tmdbId: number): Promise<Series | undefined> {
    return this.findOneBy('tmdb_id', tmdbId);
  }

  async findByTvdbId(tvdbId: number): Promise<Series | undefined> {
    return this.findOneBy('tvdb_id', tvdbId);
  }

  async listFollowed(): Promise<Series[]> {
    return this.where('e.follow = 1 ORDER BY c.id');
  }

  protected toRow(s: Omit<Series, 'id'>): RowValues {
    return {
      tmdb_id: s.tmdbId,
      tvdb_id: s.tvdbId,
      jellyfin_id: s.jellyfinId,
      title: s.title,
      original_title: s.originalTitle,
      first_air_date: s.firstAirDate,
      overview: s.overview,
      genres: JSON.stringify(s.genres),
      cast_members: JSON.stringify(s.cast),
      follow: s.follow ? 1 : 0,
      note: s.note,
      cover: s.cover,
      banner: s.banner,
      slug: s.slug,
      tags: JSON.stringify(s.tags),
      review: s.review,
    };
  }

  protected fromRow(row: Row): Series {
    return {
      id: Number(row.id),
      tmdbId: num(row.tmdb_id),
      tvdbId: num(row.tvdb_id),
      jellyfinId: text(row.jellyfin_id),
      title: String(row.title),
      originalTitle: text(row.original_title),
      firstAirDate: text(row.first_air_date),
      overview: text(row.overview),
      genres: parseList(row.genres),
      cast: parseList(row.cast_members),
      follow: Number(row.follow) === 1,
      note: text(row.note),
      cover: text(row.cover),
      banner: text(row.banner),
      slug: text(row.slug),
      tags: parseList(row.tags),
      review: text(row.review),
    };
  }
}
