import {
  applySeasonOverrides,
  availabilityWindowDays,
  matchSeasonsByAirDate,
  type Season,
  type SeasonSource,
} from '@metrack/domain';
import { emptySeason } from '../media/emptyEntities.js';
import type { SeasonOverrideRepository } from '../storage/repositories/SeasonOverrideRepository.js';
import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';
import type { ReconciledSeason } from './ReconciledSeason.js';
import type { SeriesRelease } from './SeriesRelease.js';

const DAY_MS = 86_400_000;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Links the seasons a source announces to the local seasons of a series and creates the ones that are
 * new. A season is linked by its stored provider number first, then by the date of its first episode,
 * never by number alone, so a season that Jellyfin numbers differently is not duplicated. Only seasons
 * released recently or still to come are created, so seasons missing locally from long ago are left alone.
 * Seasons without a date are not announced yet and are ignored.
 */
export function reconcileSeasons(
  seriesId: number,
  release: SeriesRelease,
  today: string,
  repositories: { seasons: SeasonRepository; overrides: SeasonOverrideRepository },
): ReconciledSeason[] {
  const { seasons, overrides } = repositories;
  const next = release.nextEpisode;
  const announced = release.seasons
    .filter(
      (s) =>
        s.number >= 1 && (release.numberOfSeasons === 0 || s.number <= release.numberOfSeasons),
    )
    .map((s) => ({
      ...s,
      airDate:
        s.airDate ??
        (next?.seasonNumber === s.number && next.episodeNumber === 1 ? next.airDate : null),
    }))
    .filter((s): s is typeof s & { airDate: string } => s.airDate !== null);

  const providerSeasons: SeasonSource[] = announced.map((s) => ({
    number: s.number,
    firstAirDate: s.airDate,
    episodeCount: s.episodeCount ?? 0,
    ...(s.name === null ? {} : { title: s.name }),
  }));
  const corrected = applySeasonOverrides(providerSeasons, overrides.listBySeries(seriesId));

  const local = seasons.listBySeries(seriesId);
  const result: ReconciledSeason[] = [];
  const unlinkedLocal: Season[] = [];
  const pending: number[] = [];
  const linked = new Set<number>();

  announced.forEach((s, index) => {
    const match = local.find((l) => l.tmdbSeasonNumber === s.number);
    if (match) {
      result.push({
        season: fillDate(seasons, match, s.airDate),
        airDate: s.airDate,
        created: false,
      });
      linked.add(match.id);
    } else {
      pending.push(index);
    }
  });
  for (const l of local) {
    if (!linked.has(l.id) && l.tmdbSeasonNumber === null && l.firstAirDate !== null) {
      unlinkedLocal.push(l);
    }
  }

  const pairs = matchSeasonsByAirDate(
    unlinkedLocal.map((l) => ({
      number: l.id,
      firstAirDate: l.firstAirDate ?? '',
      episodeCount: l.episodeCount ?? 0,
    })),
    pending.flatMap((index) => {
      const source = corrected[index];
      return source ? [{ ...source, number: index }] : [];
    }),
  );
  const matchedPending = new Set<number>();
  for (const { preferred, fallback } of pairs.matched) {
    const season = local.find((l) => l.id === preferred.number);
    const provider = announced[fallback.number];
    if (!season || !provider) continue;
    matchedPending.add(fallback.number);
    result.push({
      season: seasons.update(season.id, { tmdbSeasonNumber: provider.number }),
      airDate: provider.airDate,
      created: false,
    });
  }

  const cutoff = addDays(today, -availabilityWindowDays('season'));
  const taken = new Set(local.map((l) => l.number));
  for (const index of pending) {
    const provider = announced[index];
    const source = corrected[index];
    if (!provider || !source || matchedPending.has(index) || provider.airDate < cutoff) continue;
    const number = taken.has(source.number) ? Math.max(0, ...taken) + 1 : source.number;
    taken.add(number);
    const created = seasons.create({
      ...emptySeason(),
      seriesId,
      number,
      tmdbSeasonNumber: provider.number,
      title: source.title ?? provider.name,
      overview: provider.overview,
      firstAirDate: provider.airDate,
      episodeCount: provider.episodeCount,
    });
    result.push({ season: created, airDate: provider.airDate, created: true });
  }
  return result;
}

function fillDate(seasons: SeasonRepository, season: Season, airDate: string): Season {
  return season.firstAirDate === null
    ? seasons.update(season.id, { firstAirDate: airDate })
    : season;
}
