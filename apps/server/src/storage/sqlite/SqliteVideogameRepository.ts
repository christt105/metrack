import type { DatabaseSync } from 'node:sqlite';
import type { Videogame } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { videogameTable } from '../mapping/videogameTable.js';
import type { VideogameRepository } from '../repositories/VideogameRepository.js';
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

  async findBySteamAppId(steamAppId: string): Promise<Videogame | undefined> {
    return this.findOneBy('steam_appid', steamAppId);
  }
}
