/** Whether a game has at least one achievement and the user unlocked every one of them. */
export function hasAllAchievements(game: {
  achievementsUnlocked?: number | null;
  achievementsTotal?: number | null;
}): boolean {
  const total = game.achievementsTotal ?? 0;
  return total > 0 && game.achievementsUnlocked === total;
}
