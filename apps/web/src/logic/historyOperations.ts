import { normalizeViewings, type EpisodeOperation, type Viewing } from '@metrack/domain';
import type { HistoryRow } from './HistoryRow';

/** The operation that gives one viewing of an episode other dates. */
export function changeViewing(row: HistoryRow, replacement: Viewing): EpisodeOperation {
  const abandonedAt = row.viewing.abandonedAt;
  const next = abandonedAt === undefined ? replacement : { ...replacement, abandonedAt };
  return { op: 'setViewings', key: row.key, viewings: normalizeViewings([...row.others, next]) };
}

/** The operation that deletes one live viewing of an episode: unmarking when it was the last live one. */
export function deleteViewing(row: HistoryRow): EpisodeOperation {
  const alive = row.others.some((viewing) => viewing.abandonedAt === undefined);
  if (!alive) return { op: 'unmark', keys: [row.key] };
  return { op: 'setViewings', key: row.key, viewings: row.others };
}
