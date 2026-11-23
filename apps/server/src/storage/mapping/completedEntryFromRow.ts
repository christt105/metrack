import { normalizeEpisodeWatches, type MediaStatus } from '@metrack/domain';
import type { CompletedSeasonEntry } from '../repositories/CompletedSeasonEntry.js';
import { parseSkipped } from './episodeWatchesFromRow.js';
import type { Row } from './Row.js';
import { parseAbandoned, parseViewings } from './rowMapping.js';

export function completedEntryFromRow(row: Row): CompletedSeasonEntry {
  return {
    userId: Number(row.user_id),
    tracking: {
      status: String(row.status) as MediaStatus,
      startedAt: row.started_at === null ? null : String(row.started_at),
      finishedAt: row.finished_at === null ? null : String(row.finished_at),
      rewatches: parseViewings(row.rewatches),
      abandoned: parseAbandoned(row.abandoned),
    },
    watched: normalizeEpisodeWatches(JSON.parse(String(row.watched))),
    skipped: parseSkipped(row.skipped),
  };
}
