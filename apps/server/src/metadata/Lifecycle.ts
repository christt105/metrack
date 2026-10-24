/** What the expiry policy needs to know about an entity. `releaseDate` is ISO `YYYY-MM-DD`. */
export interface Lifecycle {
  releaseDate: string | null;
  finished: boolean;
}
