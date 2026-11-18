import { deriveSeasonTracking } from '../deriveSeasonTracking.js';
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
          episodes: draft.expected,
        },
      ]
    : [];
}

/**
 * Merges the incoming viewings into the series' stored watches (nothing is removed) and derives each draft's status
 * and dates from the result as `deriveSeasonTracking` says. A completed season that records none of its episodes
 * counts as all watched on an unknown date first, and its incoming viewings are not new, so they never open a
 * rewatch. A draft whose season would not change is left out. Ratings are never touched.
 */
export function planSeasonChanges(
  drafts: readonly SeasonDraft[],
  incoming: EpisodeWatches,
  storedWatches: EpisodeWatches | undefined,
  today: string,
): SeasonChanges {
  const stored = storedWatches ?? {};
  const inputs = drafts.flatMap(inputOf);
  const base = materializeCompletedSeasons(inputs, stored);
  const merged = mergeEpisodeWatches(base, incoming);
  const unrecorded = new Set(
    inputs.filter((input) => isUnrecordedCompletion(input, stored)).map((input) => input.seasonId),
  );
  const changes: SeasonChange[] = [];
  for (const draft of drafts) {
    const { stored: season } = draft;
    const derived = deriveSeasonTracking({
      tracking: trackingOf(season),
      episodes: draft.expected,
      watches: merged,
      baseline: season !== null && unrecorded.has(season.id) ? merged : base,
      today,
    });
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
      watchedEpisodes: draft.expected.filter(({ key }) => key in merged).length,
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
    stored.watchedCount === change.watchedEpisodes
  );
}
