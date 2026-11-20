import type { IgdbClient } from '../providers/igdb/IgdbClient.js';
import { SteamClient } from '../providers/steam/SteamClient.js';
import type { FetchFn } from '../http/FetchFn.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import type { VideogameRepository } from '../storage/repositories/VideogameRepository.js';
import type { SteamGameAdder } from './SteamGameAdder.js';
import { SteamIdResolver } from './SteamIdResolver.js';
import { SteamImportService } from './SteamImportService.js';
import type { SteamServices } from './SteamServices.js';

/** Steam is configured with `STEAM_API_KEY`; importing games also needs IGDB, which matches and adds them. */
export function createSteamServices(
  apiKey: string | undefined,
  fetchFn: FetchFn,
  games: VideogameRepository,
  settings: UserSettingsRepository,
  igdb: { client: IgdbClient; adder: SteamGameAdder } | undefined,
): SteamServices {
  const client = apiKey ? new SteamClient(fetchFn, apiKey) : null;
  return {
    ids: new SteamIdResolver(client),
    ...(client && igdb
      ? { importer: new SteamImportService(client, igdb.client, games, igdb.adder, settings) }
      : {}),
  };
}
