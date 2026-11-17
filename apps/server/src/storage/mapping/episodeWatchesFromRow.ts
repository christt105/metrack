import { normalizeEpisodeWatches } from '@metrack/domain';
import type { Row } from './Row.js';
import type { StoredEpisodeWatches } from '../repositories/StoredEpisodeWatches.js';

export function episodeWatchesFromRow(row: Row): StoredEpisodeWatches {
  return {
    userId: Number(row.user_id),
    seasonId: Number(row.season_id),
    watched: normalizeEpisodeWatches(JSON.parse(String(row.watched))),
  };
}
