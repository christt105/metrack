import { deriveSeasonTracking } from '../deriveSeasonTracking.js';
import { lastRestart } from '../lastRestart.js';
import { passWatches } from '../passWatches.js';
import type { EpisodeWatches } from '../EpisodeWatches.js';
import {
  isUnrecordedCompletion,
  materializeCompletedSeasons,
} from '../materializeCompletedSeasons.js';
import { mergeEpisodeWatches } from '../mergeEpisodeWatches.js';
import { sameEpisodeWatches } from '../sameEpisodeWatches.js';
import type { Season } from '../Season.js';
import type { SeriesSeasonInput } from '../SeriesSeasonInput.js';
import type { SeasonChange } from './SeasonChange.js';
import type { SeasonChanges } from './SeasonChanges.js';
import type { SeasonDraft } from './SeasonDraft.js';

function trackingOf(stored: Season | null) {
  return {
    status: stored?.status ?? ('planned' as const),
    startedAt: stored?.startedAt ?? null,
    finishedAt: stored?.finishedAt ?? null,
    rewatches: stored?.rewatches ?? [],
    abandoned: stored?.abandoned ?? [],
  };
}

function inputOf(draft: SeasonDraft): SeriesSeasonInput[] {
  const { stored } = draft;
  return stored
    ? [
        {
          seasonId: stored.id,
          tracking: trackingOf(stored),
          watchedCount: stored.watchedCount,
          skippedCount: stored.skippedCount,
          episodes: draft.expected,
        },
      ]
    : [];
}

function seasonFinishes(drafts: readonly SeasonDraft[]): Map<string, string | null> {
  const finishes = new Map<string, string | null>();
  for (const { stored, expected } of drafts) {
    if (!stored) continue;
    for (const { key } of expected) finishes.set(key, stored.finishedAt ?? null);
  }
  return finishes;
}

/**
 * Merges the incoming viewings into the series' stored watches (nothing is removed) and derives each draft's status
 * and dates from the result as `deriveSeasonTracking` says. A dated viewing replaces the unknown-date first viewing of an episode, also when both are stored already, as `mergeEpisodeWatches` says with the finish of the stored season. A completed season that records none of its episodes
 * counts as all watched on an unknown date first, and its incoming viewings are not new, so they never open a
 * rewatch. A draft whose season would not change is left out. Ratings are never touched.
 */
export function planSeasonChanges(
  drafts: readonly SeasonDraft[],
  incoming: EpisodeWatches,
  storedWatches: EpisodeWatches | undefined,
  today: string,
  storedSkipped: readonly string[] = [],
): SeasonChanges {
  const stored = storedWatches ?? {};
  const inputs = drafts.flatMap(inputOf);
  const base = materializeCompletedSeasons(inputs, stored, new Set(storedSkipped));
  const merged = mergeEpisodeWatches(base, incoming, seasonFinishes(drafts));
  const skipped = new Set(storedSkipped.filter((key) => !(key in incoming)));
  const unrecorded = new Set(
    inputs
      .filter((input) => isUnrecordedCompletion(input, stored, skipped))
      .map((input) => input.seasonId),
  );
  const changes: SeasonChange[] = [];
  for (const draft of drafts) {
    const { stored: season } = draft;
    const derived = deriveSeasonTracking({
      tracking: trackingOf(season),
      episodes: draft.expected,
      watches: merged,
      skipped,
      baseline: season !== null && unrecorded.has(season.id) ? merged : base,
      today,
    });
    const pass = passWatches(merged, lastRestart(season?.abandoned ?? []));
    const rewatchesChanged =
      JSON.stringify(derived.rewatches) !== JSON.stringify(season?.rewatches ?? []);
    const change: SeasonChange = {
      seasonId: season?.id ?? null,
      matchedBy: draft.matchedBy,
      jellyfinSeasonId: draft.jellyfinSeasonId,
      number: draft.number,
      tmdbSeasonNumber: draft.tmdbSeasonNumber,
      title: draft.title,
      firstAirDate: draft.firstAirDate,
      episodeCount: draft.episodeCount,
      status: derived.status,
      startedAt: derived.startedAt,
      finishedAt: derived.finishedAt,
      watchedEpisodes: draft.expected.filter(({ key }) => key in pass).length,
      skippedEpisodes: draft.expected.filter(({ key }) => skipped.has(key)).length,
      completes: derived.status === 'completed' && season?.status !== 'completed',
      missingRating: derived.status === 'completed' && (season?.rating ?? null) === null,
      ...(rewatchesChanged ? { rewatches: derived.rewatches } : {}),
    };
    if (season && !rewatchesChanged && isUnchanged(season, change)) continue;
    changes.push(change);
  }
  return {
    changes,
    ...(sameEpisodeWatches(stored, merged) ? {} : { watches: merged }),
    ...(skipped.size === storedSkipped.length ? {} : { skipped: [...skipped] }),
  };
}

function isUnchanged(stored: Season, change: SeasonChange): boolean {
  return (
    stored.jellyfinId === change.jellyfinSeasonId &&
    stored.number === change.number &&
    stored.tmdbSeasonNumber === change.tmdbSeasonNumber &&
    stored.status === change.status &&
    stored.startedAt === change.startedAt &&
    stored.finishedAt === change.finishedAt &&
    stored.episodeCount === change.episodeCount &&
    stored.firstAirDate === change.firstAirDate &&
    stored.watchedCount === change.watchedEpisodes &&
    stored.skippedCount === (change.skippedEpisodes ?? stored.skippedCount)
  );
}
