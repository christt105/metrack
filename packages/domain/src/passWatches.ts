import type { EpisodeWatches } from './EpisodeWatches.js';

/** The watches of the current pass: only the viewings finished on or after `start`, and no episode left without one. Everything with a null `start`. */
export function passWatches(watches: EpisodeWatches, start: string | null): EpisodeWatches {
  if (start === null) return watches;
  const pass: EpisodeWatches = {};
  for (const [key, viewings] of Object.entries(watches)) {
    const kept = viewings.filter((viewing) => (viewing.finishedAt ?? '') >= start);
    if (kept.length > 0) pass[key] = kept;
  }
  return pass;
}
