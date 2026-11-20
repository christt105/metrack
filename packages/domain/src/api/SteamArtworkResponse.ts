/** What one artwork request did: the games it finished and how many still wait. */
export interface SteamArtworkResponse {
  processed: number;
  remaining: number;
}
