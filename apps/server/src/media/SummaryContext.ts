import type { Season, Series } from '@metrack/domain';

/** Series and seasons loaded once per listing, so summarizing a title never queries storage. */
export interface SummaryContext {
  series: ReadonlyMap<number, Series>;
  /** The seasons of a series ordered by number, empty when it has none. */
  seasonsOf(seriesId: number): readonly Season[];
}
