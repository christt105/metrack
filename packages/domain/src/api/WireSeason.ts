import type { AbandonedPass } from '../AbandonedPass.js';
import type { Season } from '../Season.js';
import type { Viewing } from '../Viewing.js';
import type { WireTracked } from './WireTracked.js';

/**
 * A season as the connector protocol carries it. `viewings` is `rewatches` with starts and open viewings; connectors
 * that predate it only read the finish dates. `abandoned` is missing from peers that predate it.
 */
export type WireSeason = WireTracked<Omit<Season, 'abandoned'>> & {
  viewings?: Viewing[];
  abandoned?: AbandonedPass[];
};
