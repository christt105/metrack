import type { Videogame } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { videogameTable } from '../mapping/videogameTable.js';
import type { VideogameRepository } from '../repositories/VideogameRepository.js';
import type { D1Database } from './D1Database.js';
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

  async findBySteamAppId(steamAppId: string): Promise<Videogame | undefined> {
    return this.findOneBy('steam_appid', steamAppId);
  }
}
