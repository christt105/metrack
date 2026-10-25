import type { ExternalIds, MediaType } from '@metrack/domain';

export interface IdField {
  key: keyof ExternalIds;
  numeric: boolean;
}

const ID_FIELDS: Record<MediaType, IdField[]> = {
  movie: [
    { key: 'tmdbId', numeric: true },
    { key: 'jellyfinId', numeric: false },
  ],
  series: [
    { key: 'tmdbId', numeric: true },
    { key: 'tvdbId', numeric: true },
    { key: 'jellyfinId', numeric: false },
  ],
  season: [],
  videogame: [
    { key: 'igdbId', numeric: true },
    { key: 'steamAppId', numeric: false },
    { key: 'steamGridDbId', numeric: true },
  ],
  book: [
    { key: 'openLibraryId', numeric: false },
    { key: 'isbn', numeric: false },
  ],
};

/** The provider ids that can resolve an unlinked title of this type. */
export function idFieldsFor(type: MediaType): IdField[] {
  return ID_FIELDS[type];
}

/** Builds the ids to send from the typed texts, skipping blanks. */
export function buildIds(type: MediaType, texts: Record<string, string>): ExternalIds {
  const ids: Record<string, string | number> = {};
  for (const field of idFieldsFor(type)) {
    const text = String(texts[field.key] ?? '').trim();
    if (!text) continue;
    ids[field.key] = field.numeric ? Number(text) : text;
  }
  return ids as ExternalIds;
}
