import { normalizeEpisodeWatches, parseEpisodeKey, type UnmatchedEpisode } from '@metrack/domain';
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

function isUnmatched(value: unknown): value is UnmatchedEpisode {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    (item.code === 'episode_unmatched' || item.code === 'episode_other_series') &&
    typeof item.season === 'number' &&
    (item.number === null || typeof item.number === 'number') &&
    (item.name === null || typeof item.name === 'string') &&
    (item.tmdbSeriesId === undefined || typeof item.tmdbSeriesId === 'number')
  );
}

/** Reads a stored list of unmatched episodes, dropping anything malformed. */
export function parseUnmatched(value: unknown): UnmatchedEpisode[] {
  const parsed: unknown = JSON.parse(String(value ?? '[]'));
  return Array.isArray(parsed) ? parsed.filter(isUnmatched) : [];
}

export function episodeWatchesFromRow(row: Row): StoredEpisodeWatches {
  return {
    userId: Number(row.user_id),
    seriesId: Number(row.series_id),
    watched: normalizeEpisodeWatches(JSON.parse(String(row.watched))),
    skipped: parseSkipped(row.skipped),
    unmatched: parseUnmatched(row.unmatched),
  };
}
