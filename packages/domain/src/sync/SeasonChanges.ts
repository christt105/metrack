import type { EpisodeWatches } from '../EpisodeWatches.js';
import type { SeasonChange } from './SeasonChange.js';

export interface SeasonChanges {
  changes: SeasonChange[];
  /** The series' watches after the merge; present only when they change. */
  watches?: EpisodeWatches;
}
