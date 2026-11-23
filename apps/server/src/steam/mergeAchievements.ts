import type { SteamAchievement } from '@metrack/domain';
import type { SteamPlayerAchievement } from '../providers/steam/SteamPlayerAchievement.js';
import type { SteamSchemaAchievement } from '../providers/steam/SteamSchemaAchievement.js';

/**
 * Joins what a game defines with what the player unlocked. The schema decides which achievements exist and their
 * order; an achievement the player list lacks counts as locked. Unlocked ones come first, the latest unlock first.
 */
export function mergeAchievements(
  schema: SteamSchemaAchievement[],
  player: SteamPlayerAchievement[],
): SteamAchievement[] {
  const byName = new Map(player.map((entry) => [entry.apiname, entry]));
  const merged = schema.map((definition, order) => {
    const entry = byName.get(definition.name);
    const unlocked = entry?.achieved === 1;
    const time = unlocked && entry?.unlocktime ? entry.unlocktime : 0;
    const hidden = definition.hidden === 1;
    const description = definition.description?.trim() ?? '';
    const icon = unlocked ? definition.icon : definition.icongray;
    const achievement: SteamAchievement = {
      apiName: definition.name,
      name: definition.displayName || entry?.name || definition.name,
      description: hidden && !unlocked ? null : description || null,
      hidden,
      iconUrl: icon || null,
      unlocked,
      unlockedAt: time > 0 ? new Date(time * 1000).toISOString() : null,
    };
    return { achievement, time, order };
  });
  merged.sort((a, b) => {
    if (a.achievement.unlocked !== b.achievement.unlocked) return a.achievement.unlocked ? -1 : 1;
    return b.time - a.time || a.order - b.order;
  });
  return merged.map((item) => item.achievement);
}
