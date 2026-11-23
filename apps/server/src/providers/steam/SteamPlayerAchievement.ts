/** One entry of `ISteamUserStats/GetPlayerAchievements`: whether the player unlocked it and the Unix time of the unlock. */
export interface SteamPlayerAchievement {
  apiname?: string;
  achieved?: number;
  unlocktime?: number;
  name?: string;
  description?: string;
}
