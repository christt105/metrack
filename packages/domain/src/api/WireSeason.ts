import type { Season } from '../Season.js';
import type { Viewing } from '../Viewing.js';
import type { WireTracked } from './WireTracked.js';

/** A season as the connector protocol carries it. `viewings` is `rewatches` with starts and open viewings; connectors that predate it only read the finish dates. */
export type WireSeason = WireTracked<Season> & { viewings?: Viewing[] };
