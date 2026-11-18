/** An episode a season is expected to have. A null `airDate` counts as aired. */
export interface ExpectedEpisode {
  number: number;
  airDate: string | null;
}
