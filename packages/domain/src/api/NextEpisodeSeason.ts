/** The season whose episode is next. `cover` is the season's own poster, null when it has none. */
export interface NextEpisodeSeason {
  id: number;
  number: number;
  title: string | null;
  cover: string | null;
  episodeCount: number | null;
}
