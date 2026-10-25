import {
  MEDIA_TYPE_OF_COLLECTION,
  COLLECTIONS,
  type Collection,
  type ExternalIds,
  type MediaType,
  type RefreshResult,
  type ResolveUnlinkedResponse,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import type { MediaEditor } from '../media/MediaEditor.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import type { UnlinkedTitleRepository } from '../storage/repositories/UnlinkedTitleRepository.js';
import { ID_FIELDS } from './ID_FIELDS.js';
import type { TitleProviders } from './TitleProviders.js';

function collectionOf(type: MediaType): Collection {
  return COLLECTIONS.find((c) => MEDIA_TYPE_OF_COLLECTION[c] === type) as Collection;
}

/** Turns an unlinked title into a real entity once the user supplies its provider ids. */
export class UnlinkedResolver {
  constructor(
    private readonly unlinked: UnlinkedTitleRepository,
    private readonly editor: MediaEditor,
    private readonly providers: TitleProviders,
    private readonly cache: MetadataCache,
  ) {}

  async resolve(id: number, ids: ExternalIds): Promise<ResolveUnlinkedResponse> {
    const title = this.unlinked.get(id);
    if (!title) throw ApiError.notFound();
    const allowed = ID_FIELDS[title.mediaType];
    if (!allowed) {
      throw ApiError.badRequest(
        'cannot_resolve',
        `A ${title.mediaType} is linked through its series, not by id`,
      );
    }
    const given = Object.entries(ids).filter(([, value]) => value !== undefined);
    if (given.length === 0) {
      throw ApiError.badRequest('ids_required', 'At least one id is required');
    }
    const invalid = given.map(([key]) => key).filter((key) => !allowed.some((a) => a === key));
    if (invalid.length > 0) {
      throw ApiError.badRequest(
        'invalid_ids',
        `${invalid.join(', ')} do not apply to a ${title.mediaType}`,
      );
    }

    const collection = collectionOf(title.mediaType);
    const provider =
      ids.tmdbId !== undefined && (title.mediaType === 'movie' || title.mediaType === 'series')
        ? this.providers.get(title.mediaType)
        : undefined;
    let created: { type: MediaType; id: number };
    let refresh: RefreshResult | null = null;
    if (provider) {
      created = await provider.add(String(ids.tmdbId));
      const others: ExternalIds = { ...ids };
      delete others.tmdbId;
      if (Object.keys(others).length > 0) this.editor.patch(collection, created.id, { ...others });
    } else {
      const detail = this.editor.create(collection, { title: title.title, ...ids });
      created = { type: title.mediaType, id: detail.id };
      if (this.cache.supports(title.mediaType)) {
        refresh = await this.cache.refresh(title.mediaType, detail.id, true);
      }
    }
    this.unlinked.delete(id);
    return { ...created, refresh };
  }
}
