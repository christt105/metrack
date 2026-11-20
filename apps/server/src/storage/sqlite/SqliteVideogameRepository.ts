import type { DatabaseSync } from 'node:sqlite';
import type { Videogame } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { videogameTable } from '../mapping/videogameTable.js';
import type { VideogameRepository } from '../repositories/VideogameRepository.js';
import type { CatalogSteamGame } from '../repositories/CatalogSteamGame.js';
import { SqliteTableRepository } from './SqliteTableRepository.js';

export class SqliteVideogameRepository
  extends SqliteTableRepository<Videogame>
  implements VideogameRepository
{
  constructor(db: DatabaseSync, scope: UserScope) {
    super(db, scope, videogameTable);
  }

  async findByIgdbId(igdbId: number): Promise<Videogame | undefined> {
    return this.findOneBy('igdb_id', igdbId);
  }

  async listCatalogSteamGames(): Promise<CatalogSteamGame[]> {
    return this.db
      .prepare(
        'SELECT steam_appid, igdb_id, title FROM videogame WHERE steam_appid IS NOT NULL AND igdb_id IS NOT NULL',
      )
      .all()
      .map((row) => ({
        steamAppId: String(row.steam_appid),
        igdbId: Number(row.igdb_id),
        title: String(row.title),
      }));
  }

  async findBySteamAppId(steamAppId: string): Promise<Videogame | undefined> {
    return this.findOneBy('steam_appid', steamAppId);
  }
}
