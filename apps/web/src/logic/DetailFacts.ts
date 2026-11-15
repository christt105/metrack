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
}
