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

function hasAbandonment(
  episodes: readonly ExpectedEpisode[],
  watches: EpisodeWatches,
  day: string,
): boolean {
  return episodes.some(({ key }) => watches[key]?.some((viewing) => viewing.abandonedAt === day));
}

/**
 * Takes back a start over of a season: the abandoned mark is removed from the viewings abandoned on `day`, which
 * count again, by default the latest day. Refused when there is no such start over (`none`) and, for the latest
 * day, when a viewing was made on or after it (`same_day`), because the new pass would merge into the old one. An
 * earlier day can always be taken back: its viewings join the live ones in date order, so the older pass becomes
 * an earlier pass of the season.
 */
export function undoRestart(
  episodes: readonly ExpectedEpisode[],
  watches: EpisodeWatches,
  requested?: string,
): RestartResult {
  const latest = lastAbandonment(episodes, watches);
  const day = requested ?? latest;
  if (day === null || !hasAbandonment(episodes, watches, day)) return { ok: false, reason: 'none' };
  const newer =
    day === latest &&
    episodes.some(({ key }) =>
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
