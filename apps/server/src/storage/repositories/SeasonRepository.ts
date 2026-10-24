import type { DatabaseSync } from 'node:sqlite';
import type { Season } from '@metrack/domain';
import { TableRepository, type Row, type RowValues } from './TableRepository.js';
import { num, parseList, text, trackingFromRow, trackingToRow } from './rowMapping.js';

export class SeasonRepository extends TableRepository<Season> {
  constructor(db: DatabaseSync) {
    super(db, 'season');
  }

  listBySeries(seriesId: number): Season[] {
    return this.db
      .prepare('SELECT * FROM season WHERE series_id = ? ORDER BY number')
      .all(seriesId)
      .map((row) => this.fromRow(row));
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
