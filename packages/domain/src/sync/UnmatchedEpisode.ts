/** A watched library episode the planner could not record, so the user can fix its metadata. */
export interface UnmatchedEpisode {
  code: 'episode_unmatched' | 'episode_other_series';
  /** The library's season number. */
  season: number;
  /** The library's episode number, when it has one. */
  number: number | null;
  name: string | null;
  /** The TMDB series the episode belongs to; only for `episode_other_series`. */
  tmdbSeriesId?: number;
}
