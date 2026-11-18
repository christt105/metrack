import type { EpisodeWatches } from '../EpisodeWatches.js';
import type { SeasonDraft } from './SeasonDraft.js';
import type { UnmatchedEpisode } from './UnmatchedEpisode.js';
import type { SyncWarning } from './SyncWarning.js';

/** The seasons of one series that have viewings and the viewings themselves, keyed by episode. */
export interface SeriesDrafts {
  drafts: SeasonDraft[];
  incoming: EpisodeWatches;
  warnings: SyncWarning[];
  /** The watched library episodes that were not recorded; absent when the series is matched by the library's numbering. */
  unmatched?: UnmatchedEpisode[];
}
