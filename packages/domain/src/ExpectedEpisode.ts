/** An episode a season is expected to have, named by its watch key (see `episodeKey`). A null `airDate` counts as aired. */
export interface ExpectedEpisode {
  key: string;
  airDate: string | null;
}
