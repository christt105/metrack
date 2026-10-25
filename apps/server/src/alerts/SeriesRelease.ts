import type { ReleaseSeason } from './ReleaseSeason.js';

/** What a release source knows about a series. */
export interface SeriesRelease {
  posterUrl: string | null;
  numberOfSeasons: number;
  seasons: ReleaseSeason[];
  nextEpisode: { seasonNumber: number; episodeNumber: number; airDate: string } | null;
  flatrateEs: boolean;
}
