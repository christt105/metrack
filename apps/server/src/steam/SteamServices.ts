import type { SteamIdResolver } from './SteamIdResolver.js';
import type { SteamImportService } from './SteamImportService.js';

/** What the API needs for Steam: the id resolver always, the importer only when Steam and IGDB are configured. */
export interface SteamServices {
  ids: SteamIdResolver;
  importer?: SteamImportService;
}
