import type { ExpectedEpisode } from '../ExpectedEpisode.js';
import type { Season } from '../Season.js';
import type { SeasonMatchKind } from './SeasonMatchKind.js';

/** A season the sync has viewings for, before its tracking is derived. */
export interface SeasonDraft {
  stored: Season | null;
  matchedBy: SeasonMatchKind;
  jellyfinSeasonId: string | null;
  number: number;
  tmdbSeasonNumber: number | null;
  title: string | null;
  firstAirDate: string | null;
  episodeCount: number;
  /** The episodes the season is expected to have. */
  expected: ExpectedEpisode[];
}
