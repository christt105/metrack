/** Whether a fetched catalog fits the episode count a season already has; `mismatch` holds the catalog's length when it does not. */
export interface EpisodeCatalogMatch {
  applies: boolean;
  mismatch: { catalogEpisodes: number } | null;
}
