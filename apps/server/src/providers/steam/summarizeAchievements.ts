import type { SteamPlayerAchievement } from './SteamPlayerAchievement.js';
import type { SteamPlayerAchievements } from './SteamPlayerAchievements.js';

export function summarizeAchievements(
  achievements: SteamPlayerAchievement[],
): SteamPlayerAchievements {
  const unlocked = achievements.filter((a) => a.achieved === 1);
  const times = unlocked.map((a) => a.unlocktime ?? 0).filter((time) => time > 0);
  return {
    total: achievements.length,
    unlocked: unlocked.length,
    lastUnlockTime: times.length > 0 ? Math.max(...times) : null,
  };
}
