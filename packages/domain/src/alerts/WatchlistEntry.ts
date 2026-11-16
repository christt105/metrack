import type { NextEpisode } from './NextEpisode.js';

/**
 * A followed movie or series. A series shows the first air date of its newest season and the next episode
 * its last release check announced; a movie never has one.
 */
export interface WatchlistEntry {
  type: 'movie' | 'series';
  id: number;
  title: string;
  cover: string | null;
  banner: string | null;
  releaseDate: string | null;
  nextEpisode: NextEpisode | null;
}
