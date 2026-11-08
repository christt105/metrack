import type { Season, Series } from '@metrack/domain';

/**
 * The title of a season page: the season's own title, prefixed with the series title unless it already
 * names the series ("Temporada 2" becomes "Lupin - Temporada 2"). A season without a title of a series
 * with only that season takes the series title.
 */
export function seasonTitle(
  season: Season,
  series: Series | undefined,
  onlySeason: boolean,
): string {
  if (!series) return season.title || `Temporada ${season.number}`;
  if (!season.title)
    return onlySeason ? series.title : `${series.title} - Temporada ${season.number}`;
  return season.title.toLowerCase().includes(series.title.toLowerCase())
    ? season.title
    : `${series.title} - ${season.title}`;
}
