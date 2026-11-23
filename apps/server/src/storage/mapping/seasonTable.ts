import type { ManualTracking, Season } from '@metrack/domain';
import type { MediaTableSpec } from './MediaTableSpec.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';
import { num, parseList, text, trackingFromRow, trackingToRow } from './rowMapping.js';

const ENTRY_COLUMNS = [
  'jellyfin_id',
  'slug',
  'tags',
  'status',
  'started_at',
  'finished_at',
  'rating',
  'review',
  'rewatches',
  'pending_review',
  'watched_count',
  'skipped_count',
  'wants_rewatch',
  'manual_tracking',
];

function parseManual(value: unknown): ManualTracking | null {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as ManualTracking;
  } catch {
    return null;
  }
}

function seasonToRow(s: Omit<Season, 'id'>): RowValues {
  return {
    series_id: s.seriesId,
    number: s.number,
    tmdb_season_number: s.tmdbSeasonNumber,
    jellyfin_id: s.jellyfinId,
    title: s.title,
    overview: s.overview,
    first_air_date: s.firstAirDate,
    episode_count: s.episodeCount,
    watched_count: s.watchedCount,
    skipped_count: s.skippedCount,
    cover: s.cover,
    banner: s.banner,
    slug: s.slug,
    tags: JSON.stringify(s.tags),
    wants_rewatch: s.wantsRewatch ? 1 : 0,
    manual_tracking: s.manualTracking ? JSON.stringify(s.manualTracking) : null,
    ...trackingToRow(s),
  };
}

function seasonFromRow(row: Row): Season {
  return {
    id: Number(row.id),
    seriesId: Number(row.series_id),
    number: Number(row.number),
    tmdbSeasonNumber: num(row.tmdb_season_number),
    jellyfinId: text(row.jellyfin_id),
    title: text(row.title),
    overview: text(row.overview),
    firstAirDate: text(row.first_air_date),
    episodeCount: num(row.episode_count),
    watchedCount: Number(row.watched_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    cover: text(row.cover),
    banner: text(row.banner),
    slug: text(row.slug),
    tags: parseList(row.tags),
    wantsRewatch: Number(row.wants_rewatch ?? 0) === 1,
    manualTracking: parseManual(row.manual_tracking),
    ...trackingFromRow(row),
  };
}

export const seasonTable: MediaTableSpec<Season> = {
  table: 'season',
  entryColumns: ENTRY_COLUMNS,
  catalogKeys: [['series_id', 'number']],
  relatedDeletes: [],
  ownable: false,
  toRow: seasonToRow,
  fromRow: seasonFromRow,
};
