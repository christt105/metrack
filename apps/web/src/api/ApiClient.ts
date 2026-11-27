import type {
  AccountDeletion,
  CreateInviteRequest,
  CreatedInvite,
  Invite,
  UserSummary,
  UserRole,
  SyncApplyResult,
  SyncPlan,
  User,
  UserSettings,
  UserSettingsPatch,
  UserWithSettings,
} from '@metrack/domain';
import type { BackupInfo } from './BackupInfo';
import { HttpTransport } from './HttpTransport';
import { recodeToWebp } from '../logic/recodeToWebp';

import { AuthApi } from './areas/AuthApi';
import { LibraryApi } from './areas/LibraryApi';
import { SeasonsApi } from './areas/SeasonsApi';
import { ImagesApi } from './areas/ImagesApi';
import { FollowingApi } from './areas/FollowingApi';
import { SettingsApi } from './areas/SettingsApi';
import { SteamApi } from './areas/SteamApi';
import { AccountApi } from './areas/AccountApi';

/**
 * Typed access to the private editing API. The fetch function is injected so tests can fake the network.
 * `onUnauthenticated` runs when a call outside `/auth` is refused for lack of a session.
 */
export class ApiClient {
  private readonly transport: HttpTransport;
  readonly account: AccountApi;
  readonly steam: SteamApi;
  readonly settings: SettingsApi;
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
    this.account = new AccountApi(this.transport);
    this.steam = new SteamApi(this.transport);
    this.settings = new SettingsApi(this.transport);
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

  listUsers(): Promise<UserWithSettings[]> {
    return this.request('GET', '/users');
  }

  updateUserSettings(userId: number, patch: UserSettingsPatch): Promise<UserSettings> {
    return this.request('PATCH', `/users/${userId}/settings`, patch);
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

  setUserRole(userId: number, role: UserRole): Promise<User> {
    return this.request('PUT', `/users/${userId}/role`, { role });
  }
}
