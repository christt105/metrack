import type { SeasonOverride } from '@metrack/domain';
import type { Row } from './Row.js';
import { num, text } from './rowMapping.js';

export function seasonOverrideFromRow(row: Row): SeasonOverride {
  return {
    seriesId: Number(row.series_id),
    tmdbSeasonNumber: Number(row.tmdb_season_number),
    number: num(row.number),
    title: text(row.title),
    jellyfinSeasonId: text(row.jellyfin_season_id),
  };
}
