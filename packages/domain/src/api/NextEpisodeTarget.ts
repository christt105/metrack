import type { FillerCategory } from '../filler/FillerCategory.js';

/**
 * The episode that is next. Without a stored catalog only `number` is known (the season's watched count plus one),
 * `key` is null and the episode is marked by number.
 */
export interface NextEpisodeTarget {
  number: number;
  /** The key of the episode in the user's watches; null when the season has no catalog. */
  key: string | null;
  title: string | null;
  stillPath: string | null;
  /** Minutes. */
  runtime: number | null;
  airDate: string | null;
  /** What AnimeFillerList says of the episode, once the filler preview was opened for the series; null before. */
  filler: FillerCategory | null;
}
