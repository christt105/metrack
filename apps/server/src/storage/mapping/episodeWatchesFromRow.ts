import { normalizeEpisodeWatches, parseEpisodeKey } from '@metrack/domain';
import type { Row } from './Row.js';
import type { StoredEpisodeWatches } from '../repositories/StoredEpisodeWatches.js';

/** Reads a stored list of skipped keys, dropping anything that is not a valid episode key. */
export function parseSkipped(value: unknown): string[] {
  const parsed: unknown = JSON.parse(String(value ?? '[]'));
  if (!Array.isArray(parsed)) return [];
  return [
    ...new Set(
      parsed.filter((k): k is string => typeof k === 'string' && parseEpisodeKey(k) !== null),
    ),
  ];
}

export function episodeWatchesFromRow(row: Row): StoredEpisodeWatches {
  return {
    userId: Number(row.user_id),
    seriesId: Number(row.series_id),
    watched: normalizeEpisodeWatches(JSON.parse(String(row.watched))),
    skipped: parseSkipped(row.skipped),
  };
}
