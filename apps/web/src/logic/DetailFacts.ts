/** The read-only facts the header of a detail page shows. */
export interface DetailFacts {
  year: string | null;
  originalTitle: string | null;
  overview: string | null;
  genres: string[];
  /** Director, developer or authors. */
  people: string[];
  cast: string[];
  platforms: string[];
  episodeCount: number | null;
  rating: number | null;
  review: string | null;
  /** Minutes spent, stored for games and books, computed for the rest; null when there is no data. */
  timeSpentMinutes: number | null;
  /** A completed movie that has no running time, so its time cannot be computed. */
  durationUnknown: boolean;
}
