import type { SeasonOverride } from './SeasonOverride.js';
import type { SeasonSource } from './SeasonSource.js';

/** Applies manual number and title corrections to TMDB seasons. Seasons without an override are returned unchanged. */
export function applySeasonOverrides(
  tmdbSeasons: readonly SeasonSource[],
  overrides: readonly SeasonOverride[],
): SeasonSource[] {
  return tmdbSeasons.map((season) => {
    const override = overrides.find((o) => o.tmdbSeasonNumber === season.number);
    if (!override) return season;
    const corrected: SeasonSource = { ...season, number: override.number ?? season.number };
    const title = override.title ?? season.title;
    if (title !== undefined) corrected.title = title;
    return corrected;
  });
}
