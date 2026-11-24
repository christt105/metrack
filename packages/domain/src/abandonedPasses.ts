import type { AbandonedPass } from './AbandonedPass.js';
import type { SeasonEpisodeItem } from './api/SeasonEpisodeItem.js';

function earliest(dates: readonly string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a <= b ? a : b));
}

function latest(dates: readonly string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a >= b ? a : b));
}

/**
 * The passes a season was started over from, oldest first: the abandoned viewings of its episodes grouped by the day
 * they were abandoned. Skipped episodes are not owed. Computed from the viewings, never stored.
 */
export function abandonedPasses(
  episodes: readonly Pick<SeasonEpisodeItem, 'skipped' | 'viewings'>[],
): AbandonedPass[] {
  const total = episodes.filter((episode) => !episode.skipped).length;
  const days = new Map<string, { starts: string[]; finishes: string[]; episodes: number }>();
  for (const episode of episodes) {
    const seen = new Set<string>();
    for (const { startedAt, finishedAt, abandonedAt } of episode.viewings) {
      if (abandonedAt === undefined) continue;
      const day = days.get(abandonedAt) ?? { starts: [], finishes: [], episodes: 0 };
      if (!seen.has(abandonedAt)) {
        seen.add(abandonedAt);
        day.episodes += 1;
      }
      const start = startedAt ?? finishedAt;
      const finish = finishedAt ?? startedAt;
      if (start !== null) day.starts.push(start);
      if (finish !== null) day.finishes.push(finish);
      days.set(abandonedAt, day);
    }
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([abandonedOn, day]) => ({
      startedAt: earliest(day.starts),
      finishedAt: latest(day.finishes),
      abandonedOn,
      watched: day.episodes,
      total,
    }));
}
