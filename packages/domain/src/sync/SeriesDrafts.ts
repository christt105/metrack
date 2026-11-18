import type { EpisodeWatches } from '../EpisodeWatches.js';
import type { SeasonDraft } from './SeasonDraft.js';
import type { SyncWarning } from './SyncWarning.js';

/** The seasons of one series that have viewings and the viewings themselves, keyed by episode. */
export interface SeriesDrafts {
  drafts: SeasonDraft[];
  incoming: EpisodeWatches;
  warnings: SyncWarning[];
}
