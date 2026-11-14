import type {
  ConnectorSyncRequest,
  ConnectorSyncResponse,
  ConnectorSyncState,
  ConnectorUser,
  EntityRef,
  RefreshResult,
} from '@metrack/domain';
import type { AlertUser } from '../alerts/AlertUser.js';
import type { ReconcileSeasonsRequest } from '../alerts/ReconcileSeasonsRequest.js';
import type { ReconcileSeasonsResponse } from '../alerts/ReconcileSeasonsResponse.js';
import type { RecordAlertsRequest } from '../alerts/RecordAlertsRequest.js';
import type { RecordAlertsResponse } from '../alerts/RecordAlertsResponse.js';
import type { ReleaseState } from '../alerts/ReleaseState.js';
import type { FetchFn } from '../http/FetchFn.js';
import { CloudError } from './CloudError.js';

const REQUEST_TIMEOUT_MS = 60_000;

/** Calls the `/api/connector` routes of the metrack the connector syncs into. */
export class CloudClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  users(): Promise<ConnectorUser[]> {
    return this.request('GET', '/users');
  }

  syncState(userId: number): Promise<ConnectorSyncState> {
    return this.request('GET', `/users/${userId}/sync-state`);
  }

  sync(userId: number, body: ConnectorSyncRequest): Promise<ConnectorSyncResponse> {
    return this.request('POST', `/users/${userId}/sync`, body);
  }

  refresh(userId: number, ref: EntityRef): Promise<RefreshResult> {
    return this.request('POST', `/users/${userId}/refresh/${ref.type}/${ref.id}`);
  }

  alertUsers(): Promise<AlertUser[]> {
    return this.request('GET', '/alert-users');
  }

  releaseState(userId: number): Promise<ReleaseState> {
    return this.request('GET', `/users/${userId}/release-state`);
  }

  reconcileSeasons(
    userId: number,
    body: ReconcileSeasonsRequest,
  ): Promise<ReconcileSeasonsResponse> {
    return this.request('POST', `/users/${userId}/seasons`, body);
  }

  recordAlerts(userId: number, body: RecordAlertsRequest): Promise<RecordAlertsResponse> {
    return this.request('POST', `/users/${userId}/release-alerts`, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}/api/connector${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
      throw new CloudError(
        response.status,
        error.code ?? 'error',
        `${method} ${path} answered ${response.status}${error.error ? `: ${error.error}` : ''}`,
      );
    }
    return (await response.json()) as T;
  }
}
