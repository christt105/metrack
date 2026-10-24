import type { SeasonMatch } from './SeasonMatch.js';
import type { SeasonSource } from './SeasonSource.js';

export interface SeasonMatchResult {
  matched: SeasonMatch[];
  unmatchedPreferred: SeasonSource[];
  unmatchedFallback: SeasonSource[];
}
