import type {
  Language,
  SteamAchievementsDetail,
  SteamAchievementsRequest,
  SteamAchievementsResponse,
  SteamApplyResponse,
  SteamArtworkResponse,
  SteamImportReport,
} from '@metrack/domain';
import type { HttpTransport } from '../HttpTransport';

export class SteamApi {
  constructor(private readonly transport: HttpTransport) {}

  steamReport(): Promise<SteamImportReport> {
    return this.transport.request('GET', '/steam/report');
  }

  applySteam(appIds: string[]): Promise<SteamApplyResponse> {
    return this.transport.request('POST', '/steam/apply', { appIds });
  }

  prepareSteamArtwork(): Promise<SteamArtworkResponse> {
    return this.transport.request('POST', '/steam/artwork');
  }

  steamAchievements(gameId: number, language: Language): Promise<SteamAchievementsDetail> {
    return this.transport.request('GET', `/steam/achievements/${gameId}?language=${language}`);
  }

  refreshSteamAchievements(
    request: SteamAchievementsRequest = {},
  ): Promise<SteamAchievementsResponse> {
    return this.transport.request('POST', '/steam/achievements', request);
  }
}
