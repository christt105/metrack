import type { SeasonOverride } from '../SeasonOverride.js';

/** Body of `PUT /api/series/{id}/overrides/{tmdbSeasonNumber}`. */
export type SeasonOverrideInput = Omit<SeasonOverride, 'seriesId' | 'tmdbSeasonNumber'>;
