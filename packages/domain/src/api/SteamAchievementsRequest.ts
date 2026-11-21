/**
 * Asks the server to check the achievements of the user's Steam games. `gameId` checks that one game. Without it the
 * server checks the games not checked since `asOf`, the `asOf` the previous answer returned, and starts a new pass
 * when `asOf` is missing.
 */
export interface SteamAchievementsRequest {
  gameId?: number;
  asOf?: string;
}
