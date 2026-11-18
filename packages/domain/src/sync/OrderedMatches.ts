import type { ForeignMatch } from './ForeignMatch.js';
import type { OrderedMatch } from './OrderedMatch.js';
import type { UnmatchedMatch } from './UnmatchedMatch.js';

export interface OrderedMatches {
  matches: OrderedMatch[];
  /** Watched episodes no TMDB episode of the ordering could be found for. */
  unmatched: UnmatchedMatch[];
  /** Watched episodes TMDB places in another series, by that series' TMDB id; never matched, not even by position or air date. */
  foreign: Map<number, ForeignMatch>;
}
