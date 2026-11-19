import type { PlayRecord } from './PlayRecord.js';

/**
 * Playback of the companion accounts, and when the tracked account marked each played item (an ISO timestamp, by
 * Jellyfin item id). Giving it to a sync turns on the dating of items marked as played with no playback of the account.
 */
export interface HandMarkedPlays {
  companionPlays: readonly PlayRecord[];
  markedAt: ReadonlyMap<string, string>;
}
