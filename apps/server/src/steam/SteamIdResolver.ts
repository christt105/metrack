import { ApiError } from '../api/ApiError.js';
import type { SteamClient } from '../providers/steam/SteamClient.js';
import { parseSteamProfile } from './parseSteamProfile.js';

/** Turns what a user typed for their Steam account into the SteamID64 that is stored. */
export class SteamIdResolver {
  constructor(private readonly client: SteamClient | null) {}

  async resolve(input: string): Promise<string> {
    const reference = parseSteamProfile(input);
    if (!reference) {
      throw ApiError.badRequest(
        'invalid_steam_profile',
        'Enter a SteamID64, a steamcommunity.com profile address or a vanity name',
      );
    }
    if (reference.kind === 'id') return reference.steamId;
    if (!this.client) {
      throw ApiError.notImplemented(
        'steam_not_configured',
        'Steam is not configured on this server: set STEAM_API_KEY to look a profile up by name',
      );
    }
    const steamId = await this.client.resolveVanity(reference.name).catch(() => {
      throw new ApiError(502, 'steam_unavailable', 'Steam could not look that profile up');
    });
    if (!steamId) {
      throw ApiError.badRequest('steam_profile_not_found', 'Steam has no profile with that name');
    }
    return steamId;
  }
}
