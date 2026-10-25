import type { DatabaseSync } from 'node:sqlite';
import type { Series } from '@metrack/domain';
import { TableRepository, type Row, type RowValues } from './TableRepository.js';
import { num, parseList, text } from './rowMapping.js';

export class SeriesRepository extends TableRepository<Series> {
  constructor(db: DatabaseSync) {
    super(db, 'series');
  }

  listFollowed(): Series[] {
    return this.db
      .prepare('SELECT * FROM series WHERE follow = 1 ORDER BY id')
      .all()
      .map((row) => this.fromRow(row));
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
    };
  }
}
