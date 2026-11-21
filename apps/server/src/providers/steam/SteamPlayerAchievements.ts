/**
 * What `ISteamUserStats/GetPlayerAchievements` says about one game: the achievements it has, how many the player
 * unlocked and the Unix time of the latest unlock. A game without achievements is `total: 0`.
 */
export interface SteamPlayerAchievements {
  total: number;
  unlocked: number;
  lastUnlockTime: number | null;
}
