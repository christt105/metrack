import type { SteamAchievement } from './SteamAchievement.js';
import type { SteamAchievementsState } from './SteamAchievementsState.js';

/** The achievements of one game: unlocked first, the latest unlock first, then the locked ones in Steam's order. */
export interface SteamAchievementsDetail {
  state: SteamAchievementsState;
  unlocked: number;
  total: number;
  achievements: SteamAchievement[];
}
