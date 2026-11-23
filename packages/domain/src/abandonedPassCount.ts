import type { AbandonedPass } from './AbandonedPass.js';
import type { SeasonEpisodeItem } from './api/SeasonEpisodeItem.js';

/**
 * How many of the episodes still owed were viewed within an abandoned pass, out of how many are owed: the episodes
 * with a viewing between the pass's first and last date, and not before the previous pass was left. Skipped
 * episodes are not owed. Computed, never stored.
 */
export function abandonedPassCount(
  passes: readonly AbandonedPass[],
  index: number,
  episodes: readonly Pick<SeasonEpisodeItem, 'skipped' | 'viewings'>[],
): { watched: number; total: number } {
  const pass = passes[index];
  const owed = episodes.filter((episode) => !episode.skipped);
  if (pass === undefined) return { watched: 0, total: owed.length };
  const from = [pass.startedAt ?? '', passes[index - 1]?.restartedOn ?? ''].reduce((a, b) =>
    a >= b ? a : b,
  );
  const to = pass.finishedAt ?? pass.restartedOn;
  const watched = owed.filter((episode) =>
    episode.viewings.some((viewing) => {
      const date = viewing.finishedAt ?? '';
      return date !== '' && date >= from && date <= to;
    }),
  ).length;
  return { watched, total: owed.length };
}
