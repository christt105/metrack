import type { AbandonedPass, MediaStatus, TimeSpent } from '@metrack/domain';
import type { PublicKind } from './PublicKind.js';

/** One item that may be shown on a public page: a piece of the library that is not pending review. */
export interface PublicEntry {
  kind: PublicKind;
  id: number;
  title: string;
  /** File name the item had in the vault, used to resolve wikilinks in reviews. */
  slug: string | null;
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
  rating: number | null;
  review: string | null;
  rewatches: string[];
  /** The passes of a season that were left to start it over; empty for everything else. */
  abandoned: AbandonedPass[];
  cover: string | null;
  banner: string | null;
  releaseDate: string | null;
  overview: string | null;
  genres: string[];
  tags: string[];
  platforms: string[];
  developer: string | null;
  authors: string[];
  /** Address of the item at its provider, when it has an id there. */
  externalUrl: string | null;
  externalLabel: string | null;
  /** Time spent on the item; null when there is no data. */
  timeSpent: TimeSpent | null;
  /** Steam achievements of a game: how many are unlocked of how many it has; null when unknown or the game has none. */
  achievements: { unlocked: number; total: number } | null;
  /** A game with every Steam achievement unlocked. */
  allAchievements: boolean;
  /** The series a season belongs to. */
  seriesId: number | null;
}
