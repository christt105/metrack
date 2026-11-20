import type { Videogame } from '@metrack/domain';
import type { CatalogSteamGame } from './CatalogSteamGame.js';
import type { MediaEntityRepository } from './MediaEntityRepository.js';

export interface VideogameRepository extends MediaEntityRepository<Videogame> {
  findByIgdbId(igdbId: number): Promise<Videogame | undefined>;
  /** Every game in the shared catalog, whoever has it, that has both a Steam app id and an IGDB id. */
  listCatalogSteamGames(): Promise<CatalogSteamGame[]>;
  findBySteamAppId(steamAppId: string): Promise<Videogame | undefined>;
}
