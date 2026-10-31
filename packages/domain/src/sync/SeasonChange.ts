import type { MediaStatus } from '../MediaStatus.js';
import type { SeasonMatchKind } from './SeasonMatchKind.js';

/** A season to create (`seasonId` null) or update. `number` is the library number and replaces the stored one. */
export interface SeasonChange {
  seasonId: number | null;
  matchedBy: SeasonMatchKind;
  jellyfinSeasonId: string;
  number: number;
  tmdbSeasonNumber: number | null;
  title: string | null;
  firstAirDate: string | null;
  episodeCount: number;
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
  watchedEpisodes: number;
  /** Whether this change completes a season that was not completed before. */
  completes: boolean;
  missingRating: boolean;
}
