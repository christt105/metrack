import type { Artwork } from './Artwork.js';
import type { Tracking } from './Tracking.js';

export interface Videogame extends Tracking, Artwork {
  id: number;
  igdbId: number | null;
  steamAppId: string | null;
  steamGridDbId: number | null;
  title: string;
  releaseDate: string | null;
  overview: string | null;
  genres: string[];
  developer: string | null;
  platforms: string[];
  note: string | null;
  /** Minutes the user has spent on the game; null when unknown. */
  timeSpentMinutes: number | null;
  /** Steam achievements the user unlocked; null while unknown. Never read it without `achievementsTotal`. */
  achievementsUnlocked: number | null;
  /** Achievements the game has: null while unknown (not fetched, or every fetch failed), 0 when it has none. */
  achievementsTotal: number | null;
  /** Date (`YYYY-MM-DD`, UTC) of the most recent unlock; null when none is unlocked or it is unknown. */
  achievementsLastUnlockedAt: string | null;
  /** When Steam was last asked about the achievements, whether or not it answered; null when never. */
  achievementsCheckedAt: string | null;
  /** File name the item had in the vault. It keeps exported page addresses stable. */
  slug: string | null;
  tags: string[];
}
