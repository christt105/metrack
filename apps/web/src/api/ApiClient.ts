import type {
  Language,
  AccountDeletion,
  AccountStatus,
  CreateInviteRequest,
  CreatedInvite,
  Invite,
  UserSummary,
  UserRole,
  ApiToken,
  CreatedToken,
  CreateTokenRequest,
  SteamAchievementsDetail,
  SteamAchievementsRequest,
  SteamAchievementsResponse,
  SteamApplyResponse,
  SteamArtworkResponse,
  SteamImportReport,
  SyncApplyResult,
  SyncPlan,
  User,
  UserSettings,
  UserSettingsPatch,
  UserWithSettings,
  OwnSettings,
  PublicPage,
  PublicPagePatch,
} from '@metrack/domain';
import type { AccountExportData } from './AccountExportData';
import type { BackupInfo } from './BackupInfo';
import { HttpTransport } from './HttpTransport';
import { recodeToWebp } from '../logic/recodeToWebp';

import { AuthApi } from './areas/AuthApi';
import { LibraryApi } from './areas/LibraryApi';
import { SeasonsApi } from './areas/SeasonsApi';
import { ImagesApi } from './areas/ImagesApi';
import { FollowingApi } from './areas/FollowingApi';

/**
 * Typed access to the private editing API. The fetch function is injected so tests can fake the network.
 * `onUnauthenticated` runs when a call outside `/auth` is refused for lack of a session.
 */
export class ApiClient {
  private readonly transport: HttpTransport;
  readonly following: FollowingApi;
  readonly images: ImagesApi;
  readonly seasons: SeasonsApi;
  readonly library: LibraryApi;
  readonly auth: AuthApi;

  constructor(
    fetchFn: typeof fetch = (...args) => fetch(...args),
    onUnauthenticated: () => void = () => {},
    recode: (file: Blob, maxSide: number) => Promise<Blob> = recodeToWebp,
    onReachable: (reachable: boolean) => void = () => {},
  ) {
    this.transport = new HttpTransport(fetchFn, onUnauthenticated, onReachable);
    this.following = new FollowingApi(this.transport);
    this.images = new ImagesApi(this.transport, recode);
    this.seasons = new SeasonsApi(this.transport);
    this.library = new LibraryApi(this.transport);
    this.auth = new AuthApi(this.transport);
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.transport.request<T>(method, path, body);
  }

  listBackups(): Promise<BackupInfo[]> {
    return this.request('GET', '/backups');
  }

  createBackup(): Promise<BackupInfo> {
    return this.request('POST', '/backups');
  }

  syncReport(): Promise<SyncPlan> {
    return this.request('GET', '/sync/report');
  }

  applySync(): Promise<{ plan: SyncPlan; result: SyncApplyResult }> {
    return this.request('POST', '/sync/apply', { confirm: true });
  }

  ownSettings(): Promise<OwnSettings> {
    return this.request('GET', '/settings');
  }

  generateNtfyTopic(): Promise<UserSettings> {
    return this.request('POST', '/settings/ntfy-topic');
  }

  clearNtfyTopic(): Promise<UserSettings> {
    return this.request('DELETE', '/settings/ntfy-topic');
  }

  updateLanguage(language: Language | null): Promise<UserSettings> {
    return this.request('PATCH', '/settings', { language });
  }

  updateSteamId(steamId: string | null): Promise<UserSettings> {
    return this.request('PATCH', '/settings', { steamId });
  }

  steamReport(): Promise<SteamImportReport> {
    return this.request('GET', '/steam/report');
  }

  applySteam(appIds: string[]): Promise<SteamApplyResponse> {
    return this.request('POST', '/steam/apply', { appIds });
  }

  prepareSteamArtwork(): Promise<SteamArtworkResponse> {
    return this.request('POST', '/steam/artwork');
  }

  steamAchievements(gameId: number, language: Language): Promise<SteamAchievementsDetail> {
    return this.request('GET', `/steam/achievements/${gameId}?language=${language}`);
  }

  refreshSteamAchievements(
    request: SteamAchievementsRequest = {},
  ): Promise<SteamAchievementsResponse> {
    return this.request('POST', '/steam/achievements', request);
  }

  updatePublicPage(patch: PublicPagePatch): Promise<PublicPage> {
    return this.request('PATCH', '/settings/public-page', patch);
  }

  listUsers(): Promise<UserWithSettings[]> {
    return this.request('GET', '/users');
  }

  updateUserSettings(userId: number, patch: UserSettingsPatch): Promise<UserSettings> {
    return this.request('PATCH', `/users/${userId}/settings`, patch);
  }

  listTokens(): Promise<ApiToken[]> {
    return this.request('GET', '/tokens');
  }

  createToken(request: CreateTokenRequest): Promise<CreatedToken> {
    return this.request('POST', '/tokens', request);
  }

  revokeToken(id: number): Promise<void> {
    return this.request('DELETE', `/tokens/${id}`);
  }

  listInvites(): Promise<Invite[]> {
    return this.request('GET', '/invites');
  }

  createInvite(request: CreateInviteRequest): Promise<CreatedInvite> {
    return this.request('POST', '/invites', request);
  }

  revokeInvite(id: number): Promise<void> {
    return this.request('DELETE', `/invites/${id}`);
  }

  listUserSummaries(): Promise<UserSummary[]> {
    return this.request('GET', '/users/summary');
  }

  scheduleUserDeletion(userId: number): Promise<AccountDeletion> {
    return this.request('POST', `/users/${userId}/deletion`);
  }

  cancelUserDeletion(userId: number): Promise<void> {
    return this.request('DELETE', `/users/${userId}/deletion`);
  }

  accountStatus(): Promise<AccountStatus> {
    return this.request('GET', '/account');
  }

  accountExportData(): Promise<AccountExportData> {
    return this.request('GET', '/account/export/data');
  }

  requestAccountDeletion(confirm: string): Promise<AccountDeletion> {
    return this.request('POST', '/account/deletion', { confirm });
  }

  cancelAccountDeletion(): Promise<AccountStatus> {
    return this.request('DELETE', '/account/deletion');
  }

  setUserRole(userId: number, role: UserRole): Promise<User> {
    return this.request('PUT', `/users/${userId}/role`, { role });
  }
}
