import type {
  Language,
  ApiToken,
  CreatedToken,
  CreateTokenRequest,
  UserSettings,
  OwnSettings,
  PublicPage,
  PublicPagePatch,
} from '@metrack/domain';
import type { HttpTransport } from '../HttpTransport';

export class SettingsApi {
  constructor(private readonly transport: HttpTransport) {}

  ownSettings(): Promise<OwnSettings> {
    return this.transport.request('GET', '/settings');
  }

  generateNtfyTopic(): Promise<UserSettings> {
    return this.transport.request('POST', '/settings/ntfy-topic');
  }

  clearNtfyTopic(): Promise<UserSettings> {
    return this.transport.request('DELETE', '/settings/ntfy-topic');
  }

  updateLanguage(language: Language | null): Promise<UserSettings> {
    return this.transport.request('PATCH', '/settings', { language });
  }

  updateSteamId(steamId: string | null): Promise<UserSettings> {
    return this.transport.request('PATCH', '/settings', { steamId });
  }

  updatePublicPage(patch: PublicPagePatch): Promise<PublicPage> {
    return this.transport.request('PATCH', '/settings/public-page', patch);
  }

  listTokens(): Promise<ApiToken[]> {
    return this.transport.request('GET', '/tokens');
  }

  createToken(request: CreateTokenRequest): Promise<CreatedToken> {
    return this.transport.request('POST', '/tokens', request);
  }

  revokeToken(id: number): Promise<void> {
    return this.transport.request('DELETE', `/tokens/${id}`);
  }
}
