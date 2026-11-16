import type { ReleaseSeason } from './ReleaseSeason.js';

/** What a release source knows about a series. */
export interface SeriesRelease {
  posterUrl: string | null;
  numberOfSeasons: number;
  seasons: ReleaseSeason[];
  nextEpisode: {
    seasonNumber: number;
    episodeNumber: number;
    airDate: string;
    /** Absent when a connector of an older version sent the release. */
    name?: string | null;
  } | null;
  flatrateEs: boolean;
}
