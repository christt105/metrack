import { openRewatchStart } from '../openRewatchStart.js';
import type { Season } from '../Season.js';
import type { NextSeasonPick } from './NextSeasonPick.js';

const hasOpenRewatch = (season: Season): boolean =>
  season.rewatches.some((viewing) => viewing.finishedAt === null);

const isRewatched = (season: Season): boolean =>
  hasOpenRewatch(season) || (season.wantsRewatch && season.status === 'completed');

const lastClosedFinish = (season: Season): string | null =>
  season.rewatches.reduce<string | null>(
    (latest, viewing) =>
      viewing.finishedAt !== null && (latest === null || viewing.finishedAt > latest)
        ? viewing.finishedAt
        : latest,
    null,
  );

/**
 * The season whose episode is next for a series, from the user's season entries alone, or null when the series
 * has nothing to watch next. In order: the lowest season being watched again (with an open rewatch, or completed
 * and wanted again, which starts counting viewings from `today`), the first season in progress, the
 * season after the last started one when that one is completed, and, for a completed series watched again, the
 * season after the one whose rewatch closed last when it has no later rewatch. Season 0 is only chosen while it
 * is the one in progress.
 */
export function pickNextSeason(seasons: readonly Season[], today: string): NextSeasonPick | null {
  const regular = seasons
    .filter((season) => season.number !== 0)
    .sort((a, b) => a.number - b.number);

  const reopened = regular.find(isRewatched);
  if (reopened) {
    return {
      season: reopened,
      rewatchStart: openRewatchStart(reopened.rewatches) ?? today,
      rewatch: true,
      newSeason: false,
    };
  }

  const current =
    regular.find((season) => season.status === 'in_progress') ??
    seasons.find((season) => season.number === 0 && season.status === 'in_progress');
  if (current) return { season: current, rewatchStart: null, rewatch: false, newSeason: false };

  const started = regular.filter((season) => season.status !== 'planned');
  const last = started[started.length - 1];
  if (last?.status === 'completed') {
    const next = regular.find(
      (season) =>
        season.number > last.number && season.status !== 'completed' && season.status !== 'dropped',
    );
    if (next) return { season: next, rewatchStart: null, rewatch: false, newSeason: true };
  }

  if (regular.length > 1 && regular.every((season) => season.status === 'completed')) {
    let found: { index: number; finish: string } | null = null;
    for (const [index, season] of regular.entries()) {
      const finish = lastClosedFinish(season);
      if (finish !== null && (found === null || finish > found.finish)) found = { index, finish };
    }
    const next = found === null ? undefined : regular[found.index + 1];
    if (found !== null && next && (lastClosedFinish(next) ?? '') < found.finish) {
      return { season: next, rewatchStart: found.finish, rewatch: true, newSeason: false };
    }
  }
  return null;
}
