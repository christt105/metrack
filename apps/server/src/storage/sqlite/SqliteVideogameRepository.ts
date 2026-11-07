import type { DatabaseSync } from 'node:sqlite';
import type { UserScope } from '../../users/UserScope.js';
import type { Videogame } from '@metrack/domain';
import type { VideogameRepository } from '../repositories/VideogameRepository.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';
import { SqliteTableRepository } from './SqliteTableRepository.js';
import { num, parseList, text, trackingFromRow, trackingToRow } from './rowMapping.js';

const ENTRY_COLUMNS = [
  'note',
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

export class SqliteVideogameRepository
  extends SqliteTableRepository<Videogame>
  implements VideogameRepository
{
  constructor(db: DatabaseSync, scope: UserScope) {
    super(db, scope, 'videogame', ENTRY_COLUMNS, [['igdb_id']]);
  }

  async findByIgdbId(igdbId: number): Promise<Videogame | undefined> {
    return this.findOneBy('igdb_id', igdbId);
  }

  async findBySteamAppId(steamAppId: string): Promise<Videogame | undefined> {
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
      slug: g.slug,
      tags: JSON.stringify(g.tags),
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
      slug: text(row.slug),
      tags: parseList(row.tags),
      ...trackingFromRow(row),
    };
  }
}
