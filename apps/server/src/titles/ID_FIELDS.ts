import type { ExternalIds, MediaType } from '@metrack/domain';

/** Which provider ids can be assigned to a title of each type. Seasons are linked through their series. */
export const ID_FIELDS: Partial<Record<MediaType, readonly (keyof ExternalIds)[]>> = {
  movie: ['tmdbId', 'jellyfinId'],
  series: ['tmdbId', 'tvdbId', 'jellyfinId'],
  videogame: ['igdbId', 'steamAppId', 'steamGridDbId'],
  book: ['openLibraryId', 'isbn'],
};
