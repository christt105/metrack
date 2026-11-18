import type { Season, SeasonEpisodesUpdateResponse } from '@metrack/domain';

/** The season with the status, dates and watched count an episodes update answered. */
export function withTracking(season: Season, update: SeasonEpisodesUpdateResponse): Season {
  return {
    ...season,
    ...update.tracking,
    watchedCount: update.watchedCount,
    skippedCount: update.skippedCount,
  };
}
