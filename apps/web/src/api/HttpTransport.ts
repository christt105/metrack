import type { ApiErrorBody } from '@metrack/domain';
import { ApiRequestError } from './ApiRequestError';

export class HttpTransport {
  constructor(
    private readonly fetchFn: typeof fetch,
    private readonly onUnauthenticated: () => void,
    private readonly onReachable: (reachable: boolean) => void,
  ) {}

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    acceptedStatuses?: readonly number[],
  ): Promise<T> {
    const response = await this.send(method, path, body, acceptedStatuses);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async send(
    method: string,
    path: string,
    body?: unknown,
    acceptedStatuses: readonly number[] = [],
  ): Promise<Response> {
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
      this.onReachable(true);
    } catch (cause) {
      this.onReachable(false);
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
    return response;
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
}
