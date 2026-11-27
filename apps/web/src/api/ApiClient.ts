import type {
  EpisodeOperation,
  Language,
  NextEpisodesResponse,
  SeasonEpisodesResponse,
  SeasonEpisodesUpdateResponse,
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
  Collection,
  EpisodeGroupOptions,
  ImageCandidateList,
  ImageKind,
  SteamAchievementsDetail,
  SteamAchievementsRequest,
  SteamAchievementsResponse,
  SteamApplyResponse,
  SteamArtworkResponse,
  SteamImportReport,
  SyncApplyResult,
  SyncPlan,
  ReleaseAlert,
  User,
  UserSettings,
  UserSettingsPatch,
  UserWithSettings,
  OwnSettings,
  PublicPage,
  PublicPagePatch,
  WatchlistEntry,
  ImageUsage,
  UploadedImage,
} from '@metrack/domain';
import type { AccountExportData } from './AccountExportData';
import type { BackupInfo } from './BackupInfo';
import type { Detail } from './Detail';
import { HttpTransport } from './HttpTransport';
import type { ImageSettings } from './ImageSettings';
import { DEFAULT_RECODE_MAX_SIDE, recodeToWebp } from '../logic/recodeToWebp';

import { AuthApi } from './areas/AuthApi';
import { LibraryApi } from './areas/LibraryApi';

/**
 * Typed access to the private editing API. The fetch function is injected so tests can fake the network.
 * `onUnauthenticated` runs when a call outside `/auth` is refused for lack of a session.
 */
export class ApiClient {
  private readonly transport: HttpTransport;
  readonly library: LibraryApi;
  readonly auth: AuthApi;

  constructor(
    fetchFn: typeof fetch = (...args) => fetch(...args),
    onUnauthenticated: () => void = () => {},
    private readonly recode: (file: Blob, maxSide: number) => Promise<Blob> = recodeToWebp,
    onReachable: (reachable: boolean) => void = () => {},
  ) {
    this.transport = new HttpTransport(fetchFn, onUnauthenticated, onReachable);
    this.library = new LibraryApi(this.transport);
    this.auth = new AuthApi(this.transport);
  }

  private settings: Promise<ImageSettings> | undefined;

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.transport.request<T>(method, path, body);
  }

  nextEpisodes(series?: number): Promise<NextEpisodesResponse> {
    return this.request('GET', series === undefined ? '/next' : `/next?series=${series}`);
  }

  hideFromNext(seriesId: number): Promise<void> {
    return this.request('PUT', `/series/${seriesId}/next-hidden`);
  }

  showInNext(seriesId: number): Promise<void> {
    return this.request('DELETE', `/series/${seriesId}/next-hidden`);
  }

  seasonEpisodes(seasonId: number): Promise<SeasonEpisodesResponse> {
    return this.request('GET', `/seasons/${seasonId}/episodes`);
  }

  updateSeasonEpisodes(
    seasonId: number,
    operation: EpisodeOperation,
  ): Promise<SeasonEpisodesUpdateResponse> {
    return this.request('PATCH', `/seasons/${seasonId}/episodes`, operation);
  }

  restartSeason(seasonId: number): Promise<SeasonEpisodesUpdateResponse> {
    return this.request('POST', `/seasons/${seasonId}/restart`);
  }

  undoSeasonRestart(seasonId: number, day?: string): Promise<SeasonEpisodesUpdateResponse> {
    return this.request(
      'DELETE',
      `/seasons/${seasonId}/restart${day === undefined ? '' : `?day=${day}`}`,
    );
  }

  removeSeasonPass(seasonId: number, pass: number): Promise<SeasonEpisodesUpdateResponse> {
    return this.request('DELETE', `/seasons/${seasonId}/passes/${pass}`);
  }

  setSeasonRewatchIntent(seasonId: number, wanted: boolean): Promise<SeasonEpisodesUpdateResponse> {
    return this.request('PUT', `/seasons/${seasonId}/rewatch-intent`, { wanted });
  }

  episodeGroups(seriesId: number): Promise<EpisodeGroupOptions> {
    return this.request('GET', `/series/${seriesId}/episode-groups`);
  }

  setSeasonOrdering(
    seriesId: number,
    episodeGroup: string | null,
    options: { forAll?: boolean } = {},
  ): Promise<Detail<'series'>> {
    const query = options.forAll ? '?forAll=true' : '';
    return this.request('PUT', `/series/${seriesId}/season-ordering${query}`, { episodeGroup });
  }

  imageCandidates(
    collection: Collection,
    id: number,
    kind: ImageKind,
  ): Promise<ImageCandidateList> {
    return this.request('GET', `/${collection}/${id}/images/${kind}`);
  }

  chooseImage<C extends Collection>(
    collection: C,
    id: number,
    kind: ImageKind,
    url: string,
  ): Promise<Detail<C>> {
    return this.request('PUT', `/${collection}/${id}/images/${kind}`, { url });
  }

  clearImage<C extends Collection>(collection: C, id: number, kind: ImageKind): Promise<Detail<C>> {
    return this.request('DELETE', `/${collection}/${id}/images/${kind}`);
  }

  /**
   * Uploads an image file and counts it for the user's quota. The server stores it as WebP; when it reports
   * that images are encoded by the client, the file is recoded to WebP in the browser first.
   */
  async uploadImage(file: Blob): Promise<UploadedImage> {
    const { imageEncoding, maxDimension } = await this.imageSettings();
    const body = imageEncoding === 'client' ? await this.recode(file, maxDimension) : file;
    return this.request('POST', '/images', body);
  }

  private async imageSettings(): Promise<ImageSettings> {
    this.settings ??= this.imageUsage().then(({ imageEncoding, maxDimension }) => ({
      imageEncoding,
      maxDimension,
    }));
    try {
      return await this.settings;
    } catch {
      this.settings = undefined;
      return { imageEncoding: 'server', maxDimension: DEFAULT_RECODE_MAX_SIDE };
    }
  }

  imageUsage(): Promise<ImageUsage> {
    return this.request('GET', '/images/usage');
  }

  cleanupImages(): Promise<{ removed: string[] }> {
    return this.request('POST', '/images/cleanup');
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

  listWatchlist(): Promise<WatchlistEntry[]> {
    return this.request('GET', '/watchlist');
  }

  follow(collection: 'movies' | 'series', id: number): Promise<void> {
    return this.request('PUT', `/watchlist/${collection}/${id}`);
  }

  unfollow(collection: 'movies' | 'series', id: number): Promise<void> {
    return this.request('DELETE', `/watchlist/${collection}/${id}`);
  }

  listAlerts(): Promise<ReleaseAlert[]> {
    return this.request('GET', '/alerts');
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

  async imageBytes(hash: string): Promise<Uint8Array> {
    const response = await this.transport.send('GET', `/images/${hash}`);
    return new Uint8Array(await response.arrayBuffer());
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
