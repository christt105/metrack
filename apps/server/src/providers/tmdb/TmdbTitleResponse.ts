import type { TmdbSeasonSummary } from './TmdbSeasonSummary.js';

/** The subset of a TMDB movie or TV details response (with credits appended) that is used. */
export interface TmdbTitleResponse {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { name: string }[];
  seasons?: TmdbSeasonSummary[];
  credits?: {
    cast?: { name: string; character: string }[];
    crew?: { job: string; name: string }[];
  };
}
