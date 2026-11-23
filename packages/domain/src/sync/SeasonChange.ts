import type { ManualTracking } from '../ManualTracking.js';
import type { MediaStatus } from '../MediaStatus.js';
import type { Viewing } from '../Viewing.js';
import type { SeasonMatchKind } from './SeasonMatchKind.js';

/** A season to create (`seasonId` null) or update. `number` is the number the season ends up with. */
export interface SeasonChange {
  seasonId: number | null;
  matchedBy: SeasonMatchKind;
  jellyfinSeasonId: string | null;
  number: number;
  tmdbSeasonNumber: number | null;
  title: string | null;
  firstAirDate: string | null;
  episodeCount: number;
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
  /** How many of the season's episodes are watched once the series' watches are merged; absent from connectors that predate episode tracking. */
  watchedEpisodes?: number;
  /** How many of the season's episodes are skipped once the played ones are taken out; absent from connectors that predate skipping. */
  skippedEpisodes?: number;
  /** All of the season's later viewings after the change; present only when they change. */
  rewatches?: Viewing[];
  /** The season's intention to watch it again after the change; present only when it changes. */
  wantsRewatch?: boolean;
  /** What the season held before its first episode viewing, once a viewing makes it start being derived; present only when it changes. */
  manualTracking?: ManualTracking | null;
  /** Whether this change completes a season that was not completed before. */
  completes: boolean;
  missingRating: boolean;
}
