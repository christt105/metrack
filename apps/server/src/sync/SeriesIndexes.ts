import type { SeriesIndex } from '@metrack/domain';

/** What `SeriesIndexBuilder` found, by Jellyfin series id. */
export interface SeriesIndexes {
  indexes: Map<string, SeriesIndex>;
  /** Series whose watched episodes are all recorded, so there is nothing to plan for them. */
  settled: Set<string>;
}
