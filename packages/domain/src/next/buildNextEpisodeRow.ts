import type { NextEpisodeProgress } from '../api/NextEpisodeProgress.js';
import type { NextEpisodeRow } from '../api/NextEpisodeRow.js';
import type { NextEpisodeTarget } from '../api/NextEpisodeTarget.js';
import type { SeasonEpisodeItem } from '../api/SeasonEpisodeItem.js';
import { episodeKey } from '../episodeKey.js';
import { hasAired } from '../hasAired.js';
import { isDone } from '../isDone.js';
import type { Season } from '../Season.js';
import { toSeasonEpisodeItem } from '../toSeasonEpisodeItem.js';
import { unwatchedAired } from '../unwatchedAired.js';
import type { NextEpisodeInput } from './NextEpisodeInput.js';

function watchedOf(season: Season): number | null {
  if (season.watchedCount + season.skippedCount > 0)
    return season.watchedCount + season.skippedCount;
  if (season.status === 'completed' && season.episodeCount !== null) return season.episodeCount;
  return null;
}

/**
 * The row of the next-episode list for a series, or null when nothing is left to watch in the picked season (or
 * its premiere date is unknown). Only the stored catalog is used: a season without one answers with the number
 * after its watched count.
 */
export function buildNextEpisodeRow(input: NextEpisodeInput): NextEpisodeRow | null {
  const { series, pick, catalog, watches, today } = input;
  const { season } = pick;
  const rewatching = pick.rewatchStart !== null;
  const labels: NextEpisodeRow['labels'] = [];
  if (pick.rewatch) labels.push('rewatch');
  if (pick.newSeason) labels.push('newSeason');
  const base = {
    series: { id: series.id, title: series.title, cover: series.cover, banner: series.banner },
    season: {
      id: season.id,
      number: season.number,
      title: season.title,
      cover: season.cover,
      episodeCount: season.episodeCount,
    },
    labels,
    lastActivityAt: input.lastActivityAt,
  };
  const skippedCount = rewatching ? 0 : season.skippedCount;

  if (catalog === undefined || catalog.episodes.length === 0) {
    const untouched = season.watchedCount + season.skippedCount === 0;
    const premiere = season.firstAirDate !== null && season.firstAirDate > today && untouched;
    const finished =
      !pick.rewatch &&
      season.episodeCount !== null &&
      season.episodeCount > 0 &&
      season.watchedCount + season.skippedCount >= season.episodeCount;
    if (finished && !premiere) return null;
    const episode: NextEpisodeTarget = {
      number: premiere ? 1 : season.watchedCount + 1,
      key: null,
      title: null,
      stillPath: null,
      runtime: null,
      airDate: null,
      filler: null,
    };
    return {
      ...base,
      episode,
      source: 'numbers',
      availability: premiere ? 'premieres' : 'ready',
      airsOn: premiere ? season.firstAirDate : null,
      progress: {
        watched: watchedOf(season),
        total: season.episodeCount,
        skipped: skippedCount,
        rewatch: rewatching,
      },
    };
  }

  const skipped = new Set(input.skipped);
  const items: SeasonEpisodeItem[] = catalog.episodes.map((entry) => {
    const key = episodeKey(entry, season.number);
    return toSeasonEpisodeItem(
      entry,
      season.number,
      watches[key],
      skipped.has(key),
      input.filler[key] ?? null,
    );
  });
  const nextKey = unwatchedAired(items, today, undefined, pick.rewatchStart)[0];
  const pending =
    items.find((item) => item.key === nextKey) ??
    items.find((item) => !item.skipped && !isDone(item, pick.rewatchStart));
  if (pending === undefined) return null;
  const aired = nextKey !== undefined;
  const premiere = !aired && items.every((item) => !hasAired(item, today));
  const progress: NextEpisodeProgress = {
    watched: rewatching
      ? items.filter((item) => item.skipped || isDone(item, pick.rewatchStart)).length
      : watchedOf(season),
    total: items.length,
    skipped: skippedCount,
    rewatch: rewatching,
  };
  return {
    ...base,
    episode: {
      number: pending.number,
      key: pending.key,
      title: pending.title,
      stillPath: pending.stillPath,
      runtime: pending.runtime,
      airDate: pending.airDate,
      filler: pending.filler,
    },
    source: catalog.source,
    availability: aired ? 'ready' : premiere ? 'premieres' : 'airs',
    airsOn: aired ? null : pending.airDate,
    progress,
  };
}
