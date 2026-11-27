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
import type { BackupInfo } from '../BackupInfo';
import type { HttpTransport } from '../HttpTransport';

export class AdminApi {
  constructor(private readonly transport: HttpTransport) {}

  listBackups(): Promise<BackupInfo[]> {
    return this.transport.request('GET', '/backups');
  }

  createBackup(): Promise<BackupInfo> {
    return this.transport.request('POST', '/backups');
  }

  syncReport(): Promise<SyncPlan> {
    return this.transport.request('GET', '/sync/report');
  }

  applySync(): Promise<{ plan: SyncPlan; result: SyncApplyResult }> {
    return this.transport.request('POST', '/sync/apply', { confirm: true });
  }

  listUsers(): Promise<UserWithSettings[]> {
    return this.transport.request('GET', '/users');
  }

  updateUserSettings(userId: number, patch: UserSettingsPatch): Promise<UserSettings> {
    return this.transport.request('PATCH', `/users/${userId}/settings`, patch);
  }

  listInvites(): Promise<Invite[]> {
    return this.transport.request('GET', '/invites');
  }

  createInvite(request: CreateInviteRequest): Promise<CreatedInvite> {
    return this.transport.request('POST', '/invites', request);
  }

  revokeInvite(id: number): Promise<void> {
    return this.transport.request('DELETE', `/invites/${id}`);
  }

  listUserSummaries(): Promise<UserSummary[]> {
    return this.transport.request('GET', '/users/summary');
  }

  scheduleUserDeletion(userId: number): Promise<AccountDeletion> {
    return this.transport.request('POST', `/users/${userId}/deletion`);
  }

  cancelUserDeletion(userId: number): Promise<void> {
    return this.transport.request('DELETE', `/users/${userId}/deletion`);
  }

  setUserRole(userId: number, role: UserRole): Promise<User> {
    return this.transport.request('PUT', `/users/${userId}/role`, { role });
  }
}
