/**
 * What one achievements request did: the games it asked Steam about, how many of those Steam could not answer
 * (their counts are left as they were), how many still wait in the pass, and the `asOf` to send back to continue it.
 */
export interface SteamAchievementsResponse {
  processed: number;
  failed: number;
  remaining: number;
  asOf: string;
}
