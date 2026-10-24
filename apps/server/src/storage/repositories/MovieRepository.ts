import type { Movie } from '@metrack/domain';
import { TableRepository, type Row, type RowValues } from './TableRepository.js';
import { num, parseList, text, trackingFromRow, trackingToRow } from './rowMapping.js';
import type { DatabaseSync } from 'node:sqlite';

export class MovieRepository extends TableRepository<Movie> {
  constructor(db: DatabaseSync) {
    super(db, 'movie');
  }

  findByTmdbId(tmdbId: number): Movie | undefined {
    return this.findOneBy('tmdb_id', tmdbId);
  }

  protected toRow(m: Omit<Movie, 'id'>): RowValues {
    return {
      tmdb_id: m.tmdbId,
      jellyfin_id: m.jellyfinId,
      title: m.title,
      original_title: m.originalTitle,
      release_date: m.releaseDate,
      overview: m.overview,
      genres: JSON.stringify(m.genres),
      cast_members: JSON.stringify(m.cast),
      director: m.director,
      note: m.note,
      cover: m.cover,
      banner: m.banner,
      ...trackingToRow(m),
    };
  }

  protected fromRow(row: Row): Movie {
    return {
      id: Number(row.id),
      tmdbId: num(row.tmdb_id),
      jellyfinId: text(row.jellyfin_id),
      title: String(row.title),
      originalTitle: text(row.original_title),
      releaseDate: text(row.release_date),
      overview: text(row.overview),
      genres: parseList(row.genres),
      cast: parseList(row.cast_members),
      director: text(row.director),
      note: text(row.note),
      cover: text(row.cover),
      banner: text(row.banner),
      ...trackingFromRow(row),
    };
  }
}
