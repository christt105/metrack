import type { Movie } from '../Movie.js';
import type { SyncState } from '../sync/SyncState.js';
import type { WireSeason } from './WireSeason.js';
import type { WireTracked } from './WireTracked.js';

/** `SyncState` as it travels between the cloud and a connector. */
export interface WireSyncState extends Omit<SyncState, 'movies' | 'seasons'> {
  movies: readonly WireTracked<Movie>[];
  seasons: readonly WireSeason[];
}
