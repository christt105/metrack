/** The next episode of a series that a source has announced with a date. */
export interface NextEpisode {
  seasonNumber: number;
  episodeNumber: number;
  airDate: string;
  name: string | null;
}
