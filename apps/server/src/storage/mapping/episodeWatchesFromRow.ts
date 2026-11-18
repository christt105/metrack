import { normalizeEpisodeWatches } from '@metrack/domain';
import type { Row } from './Row.js';
import type { StoredEpisodeWatches } from '../repositories/StoredEpisodeWatches.js';

export function episodeWatchesFromRow(row: Row): StoredEpisodeWatches {
  return {
    userId: Number(row.user_id),
    seriesId: Number(row.series_id),
    watched: normalizeEpisodeWatches(JSON.parse(String(row.watched))),
  };
}
