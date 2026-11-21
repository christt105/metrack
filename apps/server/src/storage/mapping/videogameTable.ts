import type { Videogame } from '@metrack/domain';
import type { MediaTableSpec } from './MediaTableSpec.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';
import { num, parseList, text, trackingFromRow, trackingToRow } from './rowMapping.js';

const ENTRY_COLUMNS = [
  'note',
  'slug',
  'tags',
  'status',
  'started_at',
  'finished_at',
  'rating',
  'review',
  'rewatches',
  'pending_review',
  'time_spent_minutes',
  'achievements_unlocked',
  'achievements_total',
  'achievements_last_unlocked_at',
  'achievements_checked_at',
];

function videogameToRow(g: Omit<Videogame, 'id'>): RowValues {
  return {
    igdb_id: g.igdbId,
    steam_appid: g.steamAppId,
    steamgriddb_id: g.steamGridDbId,
    title: g.title,
    release_date: g.releaseDate,
    overview: g.overview,
    genres: JSON.stringify(g.genres),
    developer: g.developer,
    platforms: JSON.stringify(g.platforms),
    note: g.note,
    time_spent_minutes: g.timeSpentMinutes,
    achievements_unlocked: g.achievementsUnlocked,
    achievements_total: g.achievementsTotal,
    achievements_last_unlocked_at: g.achievementsLastUnlockedAt,
    achievements_checked_at: g.achievementsCheckedAt,
    cover: g.cover,
    banner: g.banner,
    slug: g.slug,
    tags: JSON.stringify(g.tags),
    ...trackingToRow(g),
  };
}

function videogameFromRow(row: Row): Videogame {
  return {
    id: Number(row.id),
    igdbId: num(row.igdb_id),
    steamAppId: text(row.steam_appid),
    steamGridDbId: num(row.steamgriddb_id),
    title: String(row.title),
    releaseDate: text(row.release_date),
    overview: text(row.overview),
    genres: parseList(row.genres),
    developer: text(row.developer),
    platforms: parseList(row.platforms),
    note: text(row.note),
    timeSpentMinutes: num(row.time_spent_minutes),
    achievementsUnlocked: num(row.achievements_unlocked),
    achievementsTotal: num(row.achievements_total),
    achievementsLastUnlockedAt: text(row.achievements_last_unlocked_at),
    achievementsCheckedAt: text(row.achievements_checked_at),
    cover: text(row.cover),
    banner: text(row.banner),
    slug: text(row.slug),
    tags: parseList(row.tags),
    ...trackingFromRow(row),
  };
}

export const videogameTable: MediaTableSpec<Videogame> = {
  table: 'videogame',
  entryColumns: ENTRY_COLUMNS,
  catalogKeys: [['igdb_id']],
  relatedDeletes: [],
  ownable: true,
  toRow: videogameToRow,
  fromRow: videogameFromRow,
};
