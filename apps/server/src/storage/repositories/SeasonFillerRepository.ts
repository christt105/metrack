import type { SeasonFiller } from './SeasonFiller.js';

/** The filler classification of a series' episodes, shared by every user and kept per season. */
export interface SeasonFillerRepository {
  get(seasonId: number): Promise<SeasonFiller | undefined>;
  /** Replaces what is stored for the series' seasons with `seasons`, dropping the seasons that are not in it. */
  replaceForSeries(seriesId: number, seasons: readonly SeasonFiller[]): Promise<void>;
}
