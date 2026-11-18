import type { UnmatchedEpisode } from '@metrack/domain';

export interface UnmatchedGroup {
  season: number;
  /** The TMDB page to fix the season on: its season page when the series has the season in its ordering, else the series page; null without a TMDB id. */
  href: string | null;
  episodes: UnmatchedEpisode[];
}

const TMDB = 'https://www.themoviedb.org/tv';

export function tmdbSeriesUrl(tmdbId: number): string {
  return `${TMDB}/${tmdbId}`;
}

/** Groups the episodes by the library season they were in, keeping only `only` when given. */
export function groupUnmatched(
  unmatched: readonly UnmatchedEpisode[],
  tmdbId: number | null,
  knownSeasons: readonly number[],
  only?: number,
): UnmatchedGroup[] {
  const seasons = [...new Set(unmatched.map((e) => e.season))]
    .filter((season) => only === undefined || season === only)
    .sort((a, b) => a - b);
  return seasons.map((season) => ({
    season,
    href:
      tmdbId === null
        ? null
        : knownSeasons.includes(season)
          ? `${TMDB}/${tmdbId}/season/${season}`
          : tmdbSeriesUrl(tmdbId),
    episodes: unmatched
      .filter((e) => e.season === season)
      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
  }));
}
