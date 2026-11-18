import type { OrderedEpisode, OrderingSeason } from '@metrack/domain';

/** The seasons and episodes of a series in the ordering it follows. */
export interface SeriesOrdering {
  seasons: OrderingSeason[];
  episodes: OrderedEpisode[];
}
