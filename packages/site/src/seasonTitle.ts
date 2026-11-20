import type { Season, Series } from '@metrack/domain';
import type { SiteMessages } from './messages/SiteMessages.js';

/**
 * The title of a season page: the season's own title, prefixed with the series title unless it already
 * names the series ("Temporada 2" becomes "Lupin - Temporada 2"). A season without a title of a series
 * with only that season takes the series title.
 */
export function seasonTitle(
  season: Season,
  series: Series | undefined,
  onlySeason: boolean,
  messages: SiteMessages,
): string {
  if (!series) return season.title || messages.seasonNumber(season.number);
  if (!season.title)
    return onlySeason ? series.title : `${series.title} - ${messages.seasonNumber(season.number)}`;
  return season.title.toLowerCase().includes(series.title.toLowerCase())
    ? season.title
    : `${series.title} - ${season.title}`;
}
