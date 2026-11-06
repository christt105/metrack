import type { Videogame } from '@metrack/domain';
import type { EntityRepository } from './EntityRepository.js';

export interface VideogameRepository extends EntityRepository<Videogame> {
  findByIgdbId(igdbId: number): Promise<Videogame | undefined>;
  findBySteamAppId(steamAppId: string): Promise<Videogame | undefined>;
}
