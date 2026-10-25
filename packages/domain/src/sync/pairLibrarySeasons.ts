import type { Season } from '../Season.js';
import type { SeasonOverride } from '../SeasonOverride.js';
import { matchSeasonsByAirDate } from '../matchSeasonsByAirDate.js';
import type { LibrarySeason } from './LibrarySeason.js';
import type { SeasonMatchKind } from './SeasonMatchKind.js';
import { seasonAirDate } from './seasonAirDate.js';

export interface SeasonPair {
  library: LibrarySeason;
  stored: Season | null;
  matchedBy: SeasonMatchKind;
}

/**
 * Pairs the library seasons of one series with its stored seasons. Order: the stored Jellyfin id, a manual
 * `season_override`, the date of the first episode, and finally the plain number for stored seasons that
 * have no air date. The library numbering is the authority, so the match never relies on numbers when dates exist.
 */
export function pairLibrarySeasons(
  library: readonly LibrarySeason[],
  stored: readonly Season[],
  overrides: readonly SeasonOverride[],
): SeasonPair[] {
  const pairs = new Map<string, SeasonPair>();
  const usedStored = new Set<number>();
  const claim = (season: LibrarySeason, row: Season, matchedBy: SeasonMatchKind): void => {
    pairs.set(season.jellyfinId, { library: season, stored: row, matchedBy });
    usedStored.add(row.id);
  };
  const pending = () => library.filter((season) => !pairs.has(season.jellyfinId));
  const free = () => stored.filter((row) => !usedStored.has(row.id));

  for (const season of library) {
    const row = stored.find((s) => s.jellyfinId === season.jellyfinId);
    if (row) claim(season, row, 'jellyfin_id');
  }
  for (const season of pending()) {
    const override = overrides.find((o) => o.jellyfinSeasonId === season.jellyfinId);
    const row = override
      ? free().find((s) => (s.tmdbSeasonNumber ?? s.number) === override.tmdbSeasonNumber)
      : undefined;
    if (row) claim(season, row, 'override');
  }

  const dated = pending().flatMap((season) => {
    const firstAirDate = seasonAirDate(season);
    return firstAirDate === null ? [] : [{ season, firstAirDate }];
  });
  const storedDated = free().flatMap((row) =>
    row.firstAirDate === null ? [] : [{ row, firstAirDate: row.firstAirDate }],
  );
  const matched = matchSeasonsByAirDate(
    dated.map(({ season, firstAirDate }) => ({
      number: season.number,
      firstAirDate,
      episodeCount: season.episodes.length,
    })),
    storedDated.map(({ row, firstAirDate }) => ({
      number: row.id,
      firstAirDate,
      episodeCount: row.episodeCount ?? 0,
    })),
  );
  for (const { preferred, fallback } of matched.matched) {
    const season = dated.find((d) => d.season.number === preferred.number)?.season;
    const row = storedDated.find((d) => d.row.id === fallback.number)?.row;
    if (season && row) claim(season, row, 'air_date');
  }

  for (const season of pending()) {
    const row = free().find((s) => s.firstAirDate === null && s.number === season.number);
    if (row) claim(season, row, 'number');
  }

  return library.map(
    (season) => pairs.get(season.jellyfinId) ?? { library: season, stored: null, matchedBy: 'new' },
  );
}
