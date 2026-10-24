import type { SeasonMatchResult } from './SeasonMatchResult.js';
import type { SeasonSource } from './SeasonSource.js';

const DAY_MS = 86_400_000;

function dayDistance(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;
}

/**
 * Pairs seasons from two providers by the date of their first episode, never by number.
 * Each season is used at most once, closest dates first. Dates further apart than `toleranceDays` do not match.
 */
export function matchSeasonsByAirDate(
  preferred: readonly SeasonSource[],
  fallback: readonly SeasonSource[],
  toleranceDays = 3,
): SeasonMatchResult {
  const candidates = preferred
    .flatMap((p, pi) =>
      fallback.map((f, fi) => ({ pi, fi, distance: dayDistance(p.firstAirDate, f.firstAirDate) })),
    )
    .filter((c) => c.distance <= toleranceDays)
    .sort((a, b) => a.distance - b.distance || a.pi - b.pi || a.fi - b.fi);

  const usedPreferred = new Set<number>();
  const usedFallback = new Set<number>();
  const matched: SeasonMatchResult['matched'] = [];
  for (const { pi, fi } of candidates) {
    const p = preferred[pi];
    const f = fallback[fi];
    if (!p || !f || usedPreferred.has(pi) || usedFallback.has(fi)) continue;
    usedPreferred.add(pi);
    usedFallback.add(fi);
    matched.push({ preferred: p, fallback: f });
  }
  matched.sort((a, b) => a.preferred.number - b.preferred.number);

  return {
    matched,
    unmatchedPreferred: preferred.filter((_, i) => !usedPreferred.has(i)),
    unmatchedFallback: fallback.filter((_, i) => !usedFallback.has(i)),
  };
}
