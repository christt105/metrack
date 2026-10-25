/** What a release source knows about a movie. */
export interface MovieRelease {
  posterUrl: string | null;
  /** First release in Spain (premiere or limited), else the worldwide release date. */
  releaseDate: string | null;
  flatrateEs: boolean;
}
