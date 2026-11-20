import type { Videogame } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { videogameTable } from '../mapping/videogameTable.js';
import type { VideogameRepository } from '../repositories/VideogameRepository.js';
import type { D1Database } from './D1Database.js';
import type { CatalogSteamGame } from '../repositories/CatalogSteamGame.js';
import { queryAll } from './d1Query.js';
import { D1TableRepository } from './D1TableRepository.js';

export class D1VideogameRepository
  extends D1TableRepository<Videogame>
  implements VideogameRepository
{
  constructor(db: D1Database, scope: UserScope) {
    super(db, scope, videogameTable);
  }

  async findByIgdbId(igdbId: number): Promise<Videogame | undefined> {
    return this.findOneBy('igdb_id', igdbId);
  }

  async listCatalogSteamGames(): Promise<CatalogSteamGame[]> {
    const rows = await queryAll(
      this.db,
      'SELECT steam_appid, igdb_id, title FROM videogame WHERE steam_appid IS NOT NULL AND igdb_id IS NOT NULL',
    );
    return rows.map((row) => ({
      steamAppId: String(row.steam_appid),
      igdbId: Number(row.igdb_id),
      title: String(row.title),
    }));
  }

  async findBySteamAppId(steamAppId: string): Promise<Videogame | undefined> {
    return this.findOneBy('steam_appid', steamAppId);
  }
}
