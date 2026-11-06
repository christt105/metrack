import type { Videogame } from '@metrack/domain';
import type { MediaEntityRepository } from './MediaEntityRepository.js';

export interface VideogameRepository extends MediaEntityRepository<Videogame> {
  findByIgdbId(igdbId: number): Promise<Videogame | undefined>;
  findBySteamAppId(steamAppId: string): Promise<Videogame | undefined>;
}
