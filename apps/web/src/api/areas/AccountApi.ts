import type { AccountDeletion, AccountStatus } from '@metrack/domain';
import type { AccountExportData } from '../AccountExportData';
import type { HttpTransport } from '../HttpTransport';

export class AccountApi {
  constructor(private readonly transport: HttpTransport) {}

  accountStatus(): Promise<AccountStatus> {
    return this.transport.request('GET', '/account');
  }

  accountExportData(): Promise<AccountExportData> {
    return this.transport.request('GET', '/account/export/data');
  }

  requestAccountDeletion(confirm: string): Promise<AccountDeletion> {
    return this.transport.request('POST', '/account/deletion', { confirm });
  }

  cancelAccountDeletion(): Promise<AccountStatus> {
    return this.transport.request('DELETE', '/account/deletion');
  }
}
