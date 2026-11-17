import type { Episode } from './Episode.js';

/** Placeholder episodes with only their numbers, for a season that has no catalog. */
export function numberedEpisodes(count: number | null): Episode[] {
  const total = count !== null && count > 0 ? Math.floor(count) : 0;
  return Array.from({ length: total }, (_, index) => ({
    number: index + 1,
    title: null,
    airDate: null,
    runtime: null,
    tmdbId: null,
    overview: null,
  }));
}
