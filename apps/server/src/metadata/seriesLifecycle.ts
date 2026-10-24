import type { Series } from '@metrack/domain';
import type { Lifecycle } from './Lifecycle.js';

/** A series that is not followed is treated as settled. */
export function seriesLifecycle(series: Series): Lifecycle {
  return { releaseDate: series.firstAirDate, finished: !series.follow };
}
