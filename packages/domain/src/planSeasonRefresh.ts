import { matchSeasonsByAirDate } from './matchSeasonsByAirDate.js';
import type { ProviderSeason } from './ProviderSeason.js';
import type { Season } from './Season.js';
import type { SeasonRefreshPlan } from './SeasonRefreshPlan.js';
import type { SeasonRefreshUpdate } from './SeasonRefreshUpdate.js';

/**
 * Links the stored seasons of a series to the seasons a provider lists and works out what to write. A season
 * is linked by its stored provider number, then by the date of its first episode, and finally by the plain
 * number for seasons that have no date. With `relink` the stored provider numbers are ignored, as after the
 * series changes its season ordering. Title, overview, date and episode count follow the provider; the cover is
 * only offered for seasons that have none.
 */
export function planSeasonRefresh(
  stored: readonly Season[],
  provider: readonly ProviderSeason[],
  relink = false,
): SeasonRefreshPlan {
  const links = new Map<number, ProviderSeason>();
  const claimed = new Set<number>();
  const link = (season: Season, match: ProviderSeason): void => {
    links.set(season.id, match);
    claimed.add(match.number);
  };
  const free = () => stored.filter((s) => !links.has(s.id));
  const unclaimed = () => provider.filter((p) => !claimed.has(p.number));

  if (!relink) {
    for (const season of stored) {
      const match = provider.find((p) => p.number === season.tmdbSeasonNumber);
      if (match && !claimed.has(match.number)) link(season, match);
    }
  }

  const eligible = free().filter(
    (season) => season.firstAirDate !== null && (relink || season.tmdbSeasonNumber === null),
  );
  const dated = unclaimed().filter((p) => p.firstAirDate !== null);
  const matched = matchSeasonsByAirDate(
    eligible.map((season) => ({
      number: season.id,
      firstAirDate: season.firstAirDate ?? '',
      episodeCount: season.episodeCount ?? 0,
    })),
    dated.map((p) => ({
      number: p.number,
      firstAirDate: p.firstAirDate ?? '',
      episodeCount: p.episodeCount ?? 0,
    })),
  );
  for (const { preferred, fallback } of matched.matched) {
    const season = stored.find((s) => s.id === preferred.number);
    const match = provider.find((p) => p.number === fallback.number);
    if (season && match) link(season, match);
  }

  for (const season of free()) {
    if (season.firstAirDate !== null || (!relink && season.tmdbSeasonNumber !== null)) continue;
    const match = unclaimed().find((p) => p.number === season.number);
    if (match) link(season, match);
  }

  const updates: SeasonRefreshUpdate[] = [];
  for (const season of stored) {
    const match = links.get(season.id);
    const fields: SeasonRefreshUpdate['fields'] = {};
    if (match) {
      if (season.tmdbSeasonNumber !== match.number) fields.tmdbSeasonNumber = match.number;
      if (match.title !== null && season.title !== match.title) fields.title = match.title;
      if (match.overview !== null && season.overview !== match.overview) {
        fields.overview = match.overview;
      }
      if (match.firstAirDate !== null && season.firstAirDate !== match.firstAirDate) {
        fields.firstAirDate = match.firstAirDate;
      }
      if (match.episodeCount !== null && season.episodeCount !== match.episodeCount) {
        fields.episodeCount = match.episodeCount;
      }
    } else if (relink && season.tmdbSeasonNumber !== null) {
      fields.tmdbSeasonNumber = null;
    }
    const coverUrl = match && season.cover === null ? match.posterUrl : null;
    if (Object.keys(fields).length > 0 || coverUrl !== null) {
      updates.push({ seasonId: season.id, fields, coverUrl });
    }
  }
  return {
    updates,
    unmatched: unclaimed(),
    unlinked: stored.filter(
      (s) => s.number >= 1 && !links.has(s.id) && (relink || s.tmdbSeasonNumber === null),
    ),
  };
}
