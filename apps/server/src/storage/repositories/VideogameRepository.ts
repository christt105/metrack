import type { DatabaseSync } from 'node:sqlite';
import type { Videogame } from '@metrack/domain';
import { TableRepository, type Row, type RowValues } from './TableRepository.js';
import { num, parseList, text, trackingFromRow, trackingToRow } from './rowMapping.js';

export class VideogameRepository extends TableRepository<Videogame> {
  constructor(db: DatabaseSync) {
    super(db, 'videogame');
  }

  findByIgdbId(igdbId: number): Videogame | undefined {
    return this.findOneBy('igdb_id', igdbId);
  }

  findBySteamAppId(steamAppId: string): Videogame | undefined {
    return this.findOneBy('steam_appid', steamAppId);
  }

  protected toRow(g: Omit<Videogame, 'id'>): RowValues {
    return {
      igdb_id: g.igdbId,
      steam_appid: g.steamAppId,
      steamgriddb_id: g.steamGridDbId,
      title: g.title,
      release_date: g.releaseDate,
      overview: g.overview,
      genres: JSON.stringify(g.genres),
      developer: g.developer,
      platforms: JSON.stringify(g.platforms),
      note: g.note,
      cover: g.cover,
      banner: g.banner,
      ...trackingToRow(g),
    };
  }

  protected fromRow(row: Row): Videogame {
    return {
      id: Number(row.id),
      igdbId: num(row.igdb_id),
      steamAppId: text(row.steam_appid),
      steamGridDbId: num(row.steamgriddb_id),
      title: String(row.title),
      releaseDate: text(row.release_date),
      overview: text(row.overview),
      genres: parseList(row.genres),
      developer: text(row.developer),
      platforms: parseList(row.platforms),
      note: text(row.note),
      cover: text(row.cover),
      banner: text(row.banner),
      ...trackingFromRow(row),
    };
  }
}
