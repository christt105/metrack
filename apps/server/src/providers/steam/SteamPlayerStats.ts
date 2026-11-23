import type { SteamPlayerAchievement } from './SteamPlayerAchievement.js';

/** The `playerstats` object of `ISteamUserStats/GetPlayerAchievements`; on failure it carries `error` and `success: false`. */
export interface SteamPlayerStats {
  success?: boolean;
  error?: string;
  achievements?: SteamPlayerAchievement[];
}
