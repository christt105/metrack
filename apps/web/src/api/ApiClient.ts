import type {
  EpisodeOperation,
  Language,
  FillerPreviewResponse,
  NextEpisodesResponse,
  SeasonEpisodesResponse,
  SeasonEpisodesUpdateResponse,
  AccountDeletion,
  AccountStatus,
  AddTitleRequest,
  CreateInviteRequest,
  CreatedInvite,
  Invite,
  InvitePreview,
  UserSummary,
  WelcomeRequest,
  UserRole,
  ApiToken,
  CreatedToken,
  CreateTokenRequest,
  Collection,
  CreateInput,
  EditablePatch,
  EntityRef,
  EpisodeGroupOptions,
  HealthReport,
  ImageCandidateList,
  ImageKind,
  MediaDetail,
  MediaPage,
  MediaQuery,
  MediaType,
  RefreshResult,
  ResolveUnlinkedRequest,
  ResolveUnlinkedResponse,
  SearchResult,
  SteamAchievementsDetail,
  SteamAchievementsRequest,
  SteamAchievementsResponse,
  SteamApplyResponse,
  SteamArtworkResponse,
  SteamImportReport,
  SyncApplyResult,
  SyncPlan,
  SearchableType,
  SeriesDetail,
  ReleaseAlert,
  UnlinkedTitle,
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
import { ApiRequestError } from './ApiRequestError';
import { buildQueryString } from './buildQueryString';
import type { EntityOf } from './EntityOf';
import { HttpTransport } from './HttpTransport';
import type { ImageSettings } from './ImageSettings';
import { DEFAULT_RECODE_MAX_SIDE, recodeToWebp } from '../logic/recodeToWebp';

type Detail<C extends Collection> = C extends 'series' ? SeriesDetail : MediaDetail<EntityOf[C]>;

/**
 * Typed access to the private editing API. The fetch function is injected so tests can fake the network.
 * `onUnauthenticated` runs when a call outside `/auth` is refused for lack of a session.
 */
export class ApiClient {
  private readonly transport: HttpTransport;

  constructor(
    fetchFn: typeof fetch = (...args) => fetch(...args),
    onUnauthenticated: () => void = () => {},
    private readonly recode: (file: Blob, maxSide: number) => Promise<Blob> = recodeToWebp,
    onReachable: (reachable: boolean) => void = () => {},
  ) {
    this.transport = new HttpTransport(fetchFn, onUnauthenticated, onReachable);
  }

  private settings: Promise<ImageSettings> | undefined;

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    acceptedStatuses?: readonly number[],
  ): Promise<T> {
    const response = await this.transport.send(method, path, body, acceptedStatuses);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** The signed-in user, or null without a session. */
  async me(): Promise<User | null> {
    try {
      return await this.request<User>('GET', '/auth/me');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) return null;
      throw error;
    }
  }

  /** Who can sign in with dev login, or null when the server does not offer it. */
  async devUsers(): Promise<User[] | null> {
    try {
      return await this.request<User[]>('GET', '/auth/dev-users');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  }

  devLogin(userId: number): Promise<User> {
    return this.request('POST', '/auth/dev-login', { userId });
  }

  tokenLogin(token: string): Promise<User> {
    return this.request('POST', '/auth/token-login', { token });
  }

  logout(): Promise<void> {
    return this.request('POST', '/auth/logout');
  }

  /** A degraded service answers 503 with the same report, which is returned rather than thrown. */
  health(): Promise<HealthReport> {
    return this.request('GET', '/health', undefined, [503]);
  }

  listMedia(query: MediaQuery): Promise<MediaPage> {
    return this.request('GET', `/media${buildQueryString(query)}`);
  }

  getDetail<C extends Collection>(collection: C, id: number): Promise<Detail<C>> {
    return this.request('GET', `/${collection}/${id}`);
  }

  create<C extends Exclude<Collection, 'seasons'>>(
    collection: C,
    input: Partial<CreateInput<EntityOf[C], never>>,
  ): Promise<Detail<C>> {
    return this.request('POST', `/${collection}`, input);
  }

  /** `forAll` is the owner's way to change a catalog field other users hold too. */
  patch<C extends Collection>(
    collection: C,
    id: number,
    patch: EditablePatch<EntityOf[C]>,
    options: { forAll?: boolean } = {},
  ): Promise<Detail<C>> {
    const query = options.forAll ? '?forAll=true' : '';
    return this.request('PATCH', `/${collection}/${id}${query}`, patch);
  }

  fillerPreview(seriesId: number, slug?: string): Promise<FillerPreviewResponse> {
    const query = slug ? `?slug=${encodeURIComponent(slug)}` : '';
    return this.request('GET', `/series/${seriesId}/filler${query}`);
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

  remove(collection: Collection, id: number): Promise<void> {
    return this.request('DELETE', `/${collection}/${id}`);
  }

  unmarkEdited<C extends Collection>(collection: C, id: number, field: string): Promise<void> {
    return this.request('DELETE', `/${collection}/${id}/edited/${encodeURIComponent(field)}`);
  }

  addRewatch<C extends Collection>(
    collection: C,
    id: number,
    finishedAt: string,
    startedAt: string | null = null,
  ): Promise<Detail<C>> {
    return this.request(
      'POST',
      `/${collection}/${id}/rewatches`,
      startedAt === null ? { finishedAt } : { startedAt, finishedAt },
    );
  }

  removeRewatch<C extends Collection>(collection: C, id: number, date: string): Promise<Detail<C>> {
    return this.request('DELETE', `/${collection}/${id}/rewatches/${encodeURIComponent(date)}`);
  }

  refreshMetadata(type: MediaType, id: number): Promise<RefreshResult> {
    return this.request('POST', `/metadata/${type}/${id}/refresh`);
  }

  search(type: SearchableType, q: string, year?: number): Promise<{ results: SearchResult[] }> {
    return this.request('GET', `/search${buildQueryString({ type, q, year })}`);
  }

  addTitle(request: AddTitleRequest): Promise<EntityRef> {
    return this.request('POST', '/titles', request);
  }

  listUnlinked(): Promise<UnlinkedTitle[]> {
    return this.request('GET', '/unlinked');
  }

  dismissUnlinked(id: number): Promise<void> {
    return this.request('DELETE', `/unlinked/${id}`);
  }

  resolveUnlinked(id: number, request: ResolveUnlinkedRequest): Promise<ResolveUnlinkedResponse> {
    return this.request('POST', `/unlinked/${id}/resolve`, request);
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

  /** Public: whether an invitation link works and who invites. Spends nothing. */
  invitePreview(code: string): Promise<InvitePreview> {
    return this.request('GET', `/invites/${encodeURIComponent(code)}`);
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

  completeWelcome(request: WelcomeRequest): Promise<User> {
    return this.request('POST', '/account/welcome', request);
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
