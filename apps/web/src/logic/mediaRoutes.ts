import type { Collection, MediaType } from '@metrack/domain';
import { MEDIA_TYPE_OF_COLLECTION } from '@metrack/domain';

const COLLECTION_OF_TYPE = Object.fromEntries(
  Object.entries(MEDIA_TYPE_OF_COLLECTION).map(([collection, type]) => [type, collection]),
) as Record<MediaType, Collection>;

/** The API collection that holds entities of a media type. */
export function collectionOf(type: MediaType): Collection {
  return COLLECTION_OF_TYPE[type];
}

/** The app route of an entity's page. */
export function detailPath(type: MediaType, id: number): string {
  return `/${collectionOf(type)}/${id}`;
}
