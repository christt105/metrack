import type { FillerCategory } from '@metrack/domain';

/** The AnimeFillerList classification of the episodes of one season. */
export interface SeasonFiller {
  seasonId: number;
  /** The show's slug on AnimeFillerList. */
  slug: string;
  /** The category of each episode, by episode key. */
  categories: Record<string, FillerCategory>;
}
