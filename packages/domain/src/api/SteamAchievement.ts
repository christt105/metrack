/** One achievement of a game for the signed-in user, in the language of the request. */
export interface SteamAchievement {
  apiName: string;
  name: string;
  /** Null for a hidden achievement that is still locked: Steam does not reveal what it asks for. */
  description: string | null;
  hidden: boolean;
  /** The colour icon when unlocked, the grey one when locked. */
  iconUrl: string | null;
  unlocked: boolean;
  /** Date and time of the unlock; null when locked or when Steam gave no time. */
  unlockedAt: string | null;
}
