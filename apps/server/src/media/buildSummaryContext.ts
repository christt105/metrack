import type { Season, Series } from '@metrack/domain';
import type { SummaryContext } from './SummaryContext.js';

/** Indexes already loaded series and seasons; seasons of one series are ordered by number. */
export function buildSummaryContext(
  series: readonly Series[],
  seasons: readonly Season[],
): SummaryContext {
  const grouped = new Map<number, Season[]>();
  for (const season of seasons) {
    const group = grouped.get(season.seriesId);
    if (group) group.push(season);
    else grouped.set(season.seriesId, [season]);
  }
  for (const group of grouped.values()) group.sort((a, b) => a.number - b.number);
  return {
    series: new Map(series.map((s) => [s.id, s])),
    seasonsOf: (seriesId) => grouped.get(seriesId) ?? [],
  };
}
