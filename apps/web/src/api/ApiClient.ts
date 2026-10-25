import type {
  AddTitleRequest,
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
  SearchableType,
  SeasonOverride,
  SeasonOverrideInput,
  SeriesDetail,
  UnlinkedTitle,
} from '@metrack/domain';
import { ApiRequestError } from './ApiRequestError';
import { buildQueryString } from './buildQueryString';
import type { EntityOf } from './EntityOf';

type Detail<C extends Collection> = C extends 'series' ? SeriesDetail : MediaDetail<EntityOf[C]>;

/** Typed access to the private editing API. The fetch function is injected so tests can fake the network. */
export class ApiClient {
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const init: RequestInit = { method };
    if (body !== undefined) {
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
    if (!response.ok) throw await this.toError(response);
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

  health(): Promise<HealthReport> {
    return this.request('GET', '/health');
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
    return this.request('DELETE', `/${collection}/${id}/rewatches/${date}`);
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

  cleanupImages(): Promise<{ removed: string[] }> {
    return this.request('POST', '/images/cleanup');
  }

  publish(): Promise<{ status: string; failures: number }> {
    return this.request('POST', '/publish');
  }
}
