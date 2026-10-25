/** A season as the release source announces it. */
export interface ReleaseSeason {
  /** The provider's own number, which can differ from the canonical one. */
  number: number;
  name: string | null;
  overview: string | null;
  airDate: string | null;
  episodeCount: number | null;
}
