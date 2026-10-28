import type { MediaStatus, Season } from '@metrack/domain';

export interface SeriesTracking {
  status: MediaStatus;
  finishedAt: string | null;
}

/**
 * Status of a series from its seasons: in progress while any season is, then paused, then completed
 * once something was finished and nothing is pending except seasons not started yet, so a new
 * season added to the list does not reopen the series until it is started.
 */
export function seriesTracking(seasons: Season[]): SeriesTracking {
  const has = (status: MediaStatus) => seasons.some((season) => season.status === status);
  const latest =
    seasons
      .map((season) => season.finishedAt)
      .filter((date): date is string => date !== null)
      .sort()
      .at(-1) ?? null;
  if (has('in_progress')) return { status: 'in_progress', finishedAt: null };
  if (has('paused')) return { status: 'paused', finishedAt: null };
  if (has('completed')) return { status: 'completed', finishedAt: latest };
  if (has('dropped')) return { status: 'dropped', finishedAt: null };
  return { status: 'planned', finishedAt: null };
}
