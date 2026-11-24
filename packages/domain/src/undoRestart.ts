import type { EpisodeWatches } from './EpisodeWatches.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import { normalizeViewings } from './normalizeViewings.js';
import type { RestartResult } from './RestartResult.js';

function lastAbandonment(
  episodes: readonly ExpectedEpisode[],
  watches: EpisodeWatches,
): string | null {
  let last: string | null = null;
  for (const { key } of episodes) {
    for (const { abandonedAt } of watches[key] ?? []) {
      if (abandonedAt !== undefined && (last === null || abandonedAt > last)) last = abandonedAt;
    }
  }
  return last;
}

/**
 * Takes back the last start over of a season: the abandoned mark is removed from the viewings abandoned on its latest
 * day, which count again. Refused when the season was never started over (`none`) and when a viewing was made on or
 * after that day (`same_day`), because the new pass would merge into the old one.
 */
export function undoRestart(
  episodes: readonly ExpectedEpisode[],
  watches: EpisodeWatches,
): RestartResult {
  const day = lastAbandonment(episodes, watches);
  if (day === null) return { ok: false, reason: 'none' };
  const newer = episodes.some(({ key }) =>
    watches[key]?.some(
      (viewing) =>
        viewing.abandonedAt === undefined &&
        [viewing.finishedAt, viewing.startedAt].some((date) => date !== null && date >= day),
    ),
  );
  if (newer) return { ok: false, reason: 'same_day' };
  const result = { ...watches };
  for (const { key } of episodes) {
    const stored = watches[key];
    if (stored?.some((viewing) => viewing.abandonedAt === day) !== true) continue;
    result[key] = normalizeViewings(
      stored.map(({ abandonedAt, ...viewing }) =>
        abandonedAt === day ? viewing : { ...viewing, abandonedAt },
      ),
    );
  }
  return { ok: true, watches: result };
}
