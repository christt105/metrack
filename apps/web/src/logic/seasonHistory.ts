import { liveViewings, type SeasonEpisodeItem, type Viewing } from '@metrack/domain';
import type { HistoryPass } from './HistoryPass';
import type { HistoryRow } from './HistoryRow';

const sameViewing = (a: Viewing, b: Viewing): boolean =>
  a.startedAt === b.startedAt && a.finishedAt === b.finishedAt && a.abandonedAt === b.abandonedAt;

function earliest(dates: readonly string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a <= b ? a : b));
}

function latest(dates: readonly string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a >= b ? a : b));
}

function rowOf(episode: SeasonEpisodeItem, viewing: Viewing): HistoryRow {
  let removed = false;
  const others = episode.viewings.filter((other) => {
    if (!removed && sameViewing(other, viewing)) {
      removed = true;
      return false;
    }
    return true;
  });
  return { key: episode.key, number: episode.number, title: episode.title, viewing, others };
}

function passOf(
  rows: HistoryRow[],
  number: number | null,
  abandonedOn: string | null,
): HistoryPass {
  const dates = (pick: (viewing: Viewing) => string | null) =>
    rows.flatMap(({ viewing }) => {
      const date = pick(viewing);
      return date === null ? [] : [date];
    });
  return {
    number,
    abandonedOn,
    rows,
    startedAt: earliest(dates(({ startedAt, finishedAt }) => startedAt ?? finishedAt)),
    finishedAt: latest(dates(({ startedAt, finishedAt }) => finishedAt ?? startedAt)),
  };
}

/**
 * The history of a season built from its episodes: the passes in order (the first time, then each rewatch, which
 * is the N-th live viewing of every episode that has one), and the passes left behind, oldest first. Skipped
 * episodes have no viewings and are not listed.
 */
export function seasonHistory(episodes: readonly SeasonEpisodeItem[]): {
  passes: HistoryPass[];
  abandoned: HistoryPass[];
} {
  const live: HistoryRow[][] = [];
  const left = new Map<string, HistoryRow[]>();
  for (const episode of episodes) {
    if (episode.skipped) continue;
    const alive: Viewing[] =
      episode.viewings.length === 0 && episode.watched
        ? [{ startedAt: null, finishedAt: null }]
        : liveViewings(episode.viewings);
    alive.forEach((viewing, at) => {
      (live[at] ??= []).push(rowOf(episode, viewing));
    });
    for (const viewing of episode.viewings) {
      if (viewing.abandonedAt === undefined) continue;
      const rows = left.get(viewing.abandonedAt) ?? [];
      rows.push(rowOf(episode, viewing));
      left.set(viewing.abandonedAt, rows);
    }
  }
  return {
    passes: live.map((rows, at) => passOf(rows, at + 1, null)),
    abandoned: [...left.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, rows]) => passOf(rows, null, day)),
  };
}
