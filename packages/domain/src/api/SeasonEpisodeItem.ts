import type { Viewing } from '../Viewing.js';

/** One episode in the answer for a season, with the signed-in user's watches of it. */
export interface SeasonEpisodeItem {
  /** The key of the episode in the user's watches. */
  key: string;
  number: number;
  tmdbId: number | null;
  title: string | null;
  airDate: string | null;
  runtime: number | null;
  overview: string | null;
  stillPath: string | null;
  watched: boolean;
  viewings: Viewing[];
}
