import type { Episode } from '../Episode.js';
import type { EpisodeSource } from '../EpisodeSource.js';
import type { EpisodeWatches } from '../EpisodeWatches.js';
import type { FillerCategory } from '../filler/FillerCategory.js';
import type { Series } from '../Series.js';
import type { NextSeasonPick } from './NextSeasonPick.js';

/** What `buildNextEpisodeRow` needs of one series. */
export interface NextEpisodeInput {
  series: Pick<Series, 'id' | 'title' | 'cover' | 'banner'>;
  pick: NextSeasonPick;
  /** The complete stored catalog of the picked season; undefined or empty when there is none. */
  catalog: { episodes: readonly Episode[]; source: EpisodeSource } | undefined;
  watches: EpisodeWatches;
  skipped: readonly string[];
  filler: Readonly<Record<string, FillerCategory>>;
  today: string;
  lastActivityAt: string | null;
}
