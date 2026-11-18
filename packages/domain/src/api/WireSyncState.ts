import type { Movie } from '../Movie.js';
import type { SyncState } from '../sync/SyncState.js';
import type { WireSeason } from './WireSeason.js';
import type { WireTracked } from './WireTracked.js';

/** `SyncState` as it travels between the cloud and a connector. */
export interface WireSyncState extends Omit<SyncState, 'movies' | 'seasons'> {
  movies: readonly WireTracked<Movie>[];
  seasons: readonly WireSeason[];
  /** Always empty. Connectors up to v0.21.0 read it to plan series and fail without it. */
  overrides: readonly never[];
}
