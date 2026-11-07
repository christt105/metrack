import type { Season, Series } from '@metrack/domain';

export function seasonTitle(
  season: Season,
  series: Series | undefined,
  onlySeason: boolean,
): string {
  if (season.title) return season.title;
  if (!series) return `Temporada ${season.number}`;
  return onlySeason ? series.title : `${series.title} - Temporada ${season.number}`;
}
