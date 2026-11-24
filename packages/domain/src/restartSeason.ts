import type { EpisodeWatches } from './EpisodeWatches.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import { countCompletePasses } from './countCompletePasses.js';
import { normalizeViewings } from './normalizeViewings.js';
import { ownPasses } from './ownPasses.js';
import type { RestartResult } from './RestartResult.js';

/**
 * Starts a season over from its first episode: the viewings of the pass in progress (the next one after the complete
 * passes, one per episode) are marked abandoned with `today`, so the next viewings begin a new pass. Refused when the
 * season is dropped or all its passes are complete (`not_in_progress`), when the pass in progress has no viewing
 * (`nothing_watched`), and when the season was already started over today (`same_day`), because two restarts on one
 * day could not be told apart and taken back one by one.
 */
export function restartSeason(
  episodes: readonly ExpectedEpisode[],
  watches: EpisodeWatches,
  skipped: ReadonlySet<string>,
  today: string,
  dropped: boolean,
): RestartResult {
  if (dropped) return { ok: false, reason: 'not_in_progress' };
  const own = ownPasses(episodes, watches);
  const complete = countCompletePasses(own, episodes, skipped, today);
  const inPass = episodes.filter(({ key }) => (own.get(key)?.length ?? 0) > complete);
  if (inPass.length === 0) {
    return { ok: false, reason: complete >= 1 ? 'not_in_progress' : 'nothing_watched' };
  }
  const restartedToday = episodes.some(({ key }) =>
    watches[key]?.some((viewing) => viewing.abandonedAt === today),
  );
  if (restartedToday) return { ok: false, reason: 'same_day' };
  const result = { ...watches };
  for (const { key } of inPass) {
    const stored = watches[key] ?? [];
    const live = own.get(key) ?? [];
    const target = live[complete];
    if (target === undefined) continue;
    result[key] = normalizeViewings([
      ...stored.filter((viewing) => viewing.abandonedAt !== undefined),
      { ...target, abandonedAt: today },
      ...live.filter((_, at) => at !== complete),
    ]);
  }
  return { ok: true, watches: result };
}
