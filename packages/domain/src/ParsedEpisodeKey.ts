/** What a stored episode key names: a TMDB episode id, or a season and episode number in metrack's numbering. */
export type ParsedEpisodeKey =
  | { kind: 'tmdb'; tmdbId: number }
  | { kind: 'number'; seasonNumber: number; episodeNumber: number };
