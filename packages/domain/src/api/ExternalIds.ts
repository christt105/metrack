/** Provider ids that can be assigned to a title. Which ones apply depends on the entity type. */
export interface ExternalIds {
  tmdbId?: number;
  tvdbId?: number;
  jellyfinId?: string;
  igdbId?: number;
  steamAppId?: string;
  steamGridDbId?: number;
  openLibraryId?: string;
  isbn?: string;
}
