import type { Viewing } from '../Viewing.js';

/** One episode in the answer for a season, with the signed-in user's watches of it. */
export interface SeasonEpisodeItem {
  number: number;
  title: string | null;
  airDate: string | null;
  runtime: number | null;
  overview: string | null;
  watched: boolean;
  viewings: Viewing[];
}
