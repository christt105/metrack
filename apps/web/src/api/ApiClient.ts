import type {
  AccountDeletion,
  AccountStatus,
  AddTitleRequest,
  UserRole,
  ApiToken,
  CreatedToken,
  CreateTokenRequest,
  ApiErrorBody,
  Collection,
  CreateInput,
  EditablePatch,
  EntityRef,
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
  SyncApplyResult,
  SyncPlan,
  SearchableType,
  SeasonOverride,
  SeasonOverrideInput,
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
import type { BackupInfo } from './BackupInfo';
import { ApiRequestError } from './ApiRequestError';
import { buildQueryString } from './buildQueryString';
import type { EntityOf } from './EntityOf';
import type { ImageSettings } from './ImageSettings';
import { DEFAULT_RECODE_MAX_SIDE, recodeToWebp } from '../logic/recodeToWebp';

type Detail<C extends Collection> = C extends 'series' ? SeriesDetail : MediaDetail<EntityOf[C]>;

/**
 * Typed access to the private editing API. The fetch function is injected so tests can fake the network.
 * `onUnauthenticated` runs when a call outside `/auth` is refused for lack of a session.
 */
export class ApiClient {
  constructor(
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly onUnauthenticated: () => void = () => {},
    private readonly recode: (file: Blob, maxSide: number) => Promise<Blob> = recodeToWebp,
  ) {}

  private settings: Promise<ImageSettings> | undefined;

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    acceptedStatuses: readonly number[] = [],
  ): Promise<T> {
    const init: RequestInit = { method };
    if (body instanceof Blob) {
      init.headers = { 'content-type': body.type || 'application/octet-stream' };
      init.body = body;
    } else if (body !== undefined) {
      init.headers = { 'content-type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    let response: Response;
    try {
      response = await this.fetchFn(`/api${path}`, init);
    } catch (cause) {
      throw new ApiRequestError(
        cause instanceof Error ? cause.message : 'Network error',
        0,
        'network_error',
      );
    }
    if (!response.ok && !acceptedStatuses.includes(response.status)) {
      if (response.status === 401 && !path.startsWith('/auth/')) this.onUnauthenticated();
      throw await this.toError(response);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async toError(response: Response): Promise<ApiRequestError> {
    try {
      const body = (await response.json()) as Partial<ApiErrorBody>;
      return new ApiRequestError(
        body.error ?? `Request failed with status ${response.status}`,
        response.status,
        body.code ?? '',
        body.details,
      );
    } catch {
      return new ApiRequestError(
        `Request failed with status ${response.status}`,
        response.status,
        '',
      );
    }
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

  create<C extends Collection>(
    collection: C,
    input: Partial<CreateInput<EntityOf[C], never>>,
  ): Promise<Detail<C>> {
    return this.request('POST', `/${collection}`, input);
  }

  patch<C extends Collection>(
    collection: C,
    id: number,
    patch: EditablePatch<EntityOf[C]>,
  ): Promise<Detail<C>> {
    return this.request('PATCH', `/${collection}/${id}`, patch);
  }

  remove(collection: Collection, id: number): Promise<void> {
    return this.request('DELETE', `/${collection}/${id}`);
  }

  unmarkEdited<C extends Collection>(collection: C, id: number, field: string): Promise<void> {
    return this.request('DELETE', `/${collection}/${id}/edited/${encodeURIComponent(field)}`);
  }

  addRewatch<C extends Collection>(collection: C, id: number, date: string): Promise<Detail<C>> {
    return this.request('POST', `/${collection}/${id}/rewatches`, { date });
  }

  removeRewatch<C extends Collection>(collection: C, id: number, date: string): Promise<Detail<C>> {
    return this.request('DELETE', `/${collection}/${id}/rewatches/${encodeURIComponent(date)}`);
  }

  putOverride(
    seriesId: number,
    tmdbSeasonNumber: number,
    input: SeasonOverrideInput,
  ): Promise<SeasonOverride> {
    return this.request('PUT', `/series/${seriesId}/overrides/${tmdbSeasonNumber}`, input);
  }

  deleteOverride(seriesId: number, tmdbSeasonNumber: number): Promise<void> {
    return this.request('DELETE', `/series/${seriesId}/overrides/${tmdbSeasonNumber}`);
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

  publish(): Promise<{ status: string; failures: number }> {
    return this.request('POST', '/publish');
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

  accountStatus(): Promise<AccountStatus> {
    return this.request('GET', '/account');
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
