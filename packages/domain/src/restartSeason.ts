import type { EpisodeWatches } from './EpisodeWatches.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import { lastRestart } from './lastRestart.js';
import { passWatches } from './passWatches.js';
import type { RestartResult } from './RestartResult.js';
import type { SeasonTracking } from './SeasonTracking.js';

/**
 * Starts a season in progress over from its first episode: the current pass, from its first to its last viewing, is
 * kept in `abandoned`, and the dates start empty so the next viewings begin the new pass (see `passWatches`).
 * Refused when the season is not in progress, has no viewing in the current pass, or its last viewing is dated today
 * or later, because a viewing made today could not be told from the old pass.
 */
export function restartSeason(
  tracking: SeasonTracking,
  episodes: readonly ExpectedEpisode[],
  watches: EpisodeWatches,
  today: string,
): RestartResult {
  if (tracking.status !== 'in_progress') return { ok: false, reason: 'not_in_progress' };
  const own: EpisodeWatches = {};
  for (const { key } of episodes) {
    const viewings = watches[key];
    if (viewings !== undefined) own[key] = viewings;
  }
  const pass = passWatches(own, lastRestart(tracking.abandoned));
  const keys = Object.keys(pass);
  if (keys.length === 0) return { ok: false, reason: 'nothing_watched' };
  const finishes = keys.flatMap((key) =>
    (pass[key] ?? []).flatMap((viewing) =>
      viewing.finishedAt === null ? [] : [viewing.finishedAt],
    ),
  );
  const finishedAt = finishes.length === 0 ? null : finishes.reduce((a, b) => (a >= b ? a : b));
  if (finishedAt !== null && finishedAt >= today) return { ok: false, reason: 'same_day' };
  return {
    ok: true,
    tracking: {
      ...tracking,
      startedAt: null,
      finishedAt: null,
      abandoned: [
        ...tracking.abandoned,
        { startedAt: tracking.startedAt, finishedAt, restartedOn: today },
      ],
    },
  };
}
