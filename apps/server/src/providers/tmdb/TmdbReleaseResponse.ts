import type { TmdbSeasonSummary } from './TmdbSeasonSummary.js';

interface TmdbProviderEntry {
  provider_name: string;
}

/** The subset of a TMDB movie or TV response, with `watch/providers` and `release_dates` appended, used for alerts. */
export interface TmdbReleaseResponse {
  poster_path?: string | null;
  release_date?: string;
  number_of_seasons?: number;
  seasons?: TmdbSeasonSummary[];
  next_episode_to_air?: { season_number: number; episode_number: number; air_date?: string } | null;
  'watch/providers'?: {
    results?: Record<
      string,
      { flatrate?: TmdbProviderEntry[]; buy?: TmdbProviderEntry[]; rent?: TmdbProviderEntry[] }
    >;
  };
  release_dates?: {
    results?: { iso_3166_1: string; release_dates: { type: number; release_date: string }[] }[];
  };
}
