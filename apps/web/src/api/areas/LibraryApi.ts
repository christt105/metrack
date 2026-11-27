import type {
  FillerPreviewResponse,
  AddTitleRequest,
  Collection,
  CreateInput,
  EditablePatch,
  EntityRef,
  MediaPage,
  MediaQuery,
  MediaType,
  RefreshResult,
  ResolveUnlinkedRequest,
  ResolveUnlinkedResponse,
  SearchResult,
  SearchableType,
  UnlinkedTitle,
} from '@metrack/domain';
import { buildQueryString } from '../buildQueryString';
import type { Detail } from '../Detail';
import type { EntityOf } from '../EntityOf';
import type { HttpTransport } from '../HttpTransport';

export class LibraryApi {
  constructor(private readonly transport: HttpTransport) {}

  listMedia(query: MediaQuery): Promise<MediaPage> {
    return this.transport.request('GET', `/media${buildQueryString(query)}`);
  }

  getDetail<C extends Collection>(collection: C, id: number): Promise<Detail<C>> {
    return this.transport.request('GET', `/${collection}/${id}`);
  }

  create<C extends Exclude<Collection, 'seasons'>>(
    collection: C,
    input: Partial<CreateInput<EntityOf[C], never>>,
  ): Promise<Detail<C>> {
    return this.transport.request('POST', `/${collection}`, input);
  }

  /** `forAll` is the owner's way to change a catalog field other users hold too. */
  patch<C extends Collection>(
    collection: C,
    id: number,
    patch: EditablePatch<EntityOf[C]>,
    options: { forAll?: boolean } = {},
  ): Promise<Detail<C>> {
    const query = options.forAll ? '?forAll=true' : '';
    return this.transport.request('PATCH', `/${collection}/${id}${query}`, patch);
  }

  fillerPreview(seriesId: number, slug?: string): Promise<FillerPreviewResponse> {
    const query = slug ? `?slug=${encodeURIComponent(slug)}` : '';
    return this.transport.request('GET', `/series/${seriesId}/filler${query}`);
  }

  remove(collection: Collection, id: number): Promise<void> {
    return this.transport.request('DELETE', `/${collection}/${id}`);
  }

  unmarkEdited<C extends Collection>(collection: C, id: number, field: string): Promise<void> {
    return this.transport.request(
      'DELETE',
      `/${collection}/${id}/edited/${encodeURIComponent(field)}`,
    );
  }

  addRewatch<C extends Collection>(
    collection: C,
    id: number,
    finishedAt: string,
    startedAt: string | null = null,
  ): Promise<Detail<C>> {
    return this.transport.request(
      'POST',
      `/${collection}/${id}/rewatches`,
      startedAt === null ? { finishedAt } : { startedAt, finishedAt },
    );
  }

  removeRewatch<C extends Collection>(collection: C, id: number, date: string): Promise<Detail<C>> {
    return this.transport.request(
      'DELETE',
      `/${collection}/${id}/rewatches/${encodeURIComponent(date)}`,
    );
  }

  refreshMetadata(type: MediaType, id: number): Promise<RefreshResult> {
    return this.transport.request('POST', `/metadata/${type}/${id}/refresh`);
  }

  search(type: SearchableType, q: string, year?: number): Promise<{ results: SearchResult[] }> {
    return this.transport.request('GET', `/search${buildQueryString({ type, q, year })}`);
  }

  addTitle(request: AddTitleRequest): Promise<EntityRef> {
    return this.transport.request('POST', '/titles', request);
  }

  listUnlinked(): Promise<UnlinkedTitle[]> {
    return this.transport.request('GET', '/unlinked');
  }

  dismissUnlinked(id: number): Promise<void> {
    return this.transport.request('DELETE', `/unlinked/${id}`);
  }

  resolveUnlinked(id: number, request: ResolveUnlinkedRequest): Promise<ResolveUnlinkedResponse> {
    return this.transport.request('POST', `/unlinked/${id}/resolve`, request);
  }
}
