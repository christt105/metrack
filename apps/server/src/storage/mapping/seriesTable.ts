import type { NextEpisode, Series } from '@metrack/domain';
import type { MediaTableSpec } from './MediaTableSpec.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';
import { num, parseList, text } from './rowMapping.js';

const ENTRY_COLUMNS = ['jellyfin_id', 'follow', 'note', 'slug', 'tags', 'review'];

const RELATED_DELETES = [
  'DELETE FROM season_entry WHERE user_id = ? AND season_id IN (SELECT id FROM season WHERE series_id = ?)',
  'DELETE FROM series_episode_entry WHERE user_id = ? AND series_id = ?',
];

function seriesToRow(s: Omit<Series, 'id'>): RowValues {
  return {
    tmdb_id: s.tmdbId,
    tvdb_id: s.tvdbId,
    tmdb_episode_group: s.tmdbEpisodeGroup,
    jellyfin_id: s.jellyfinId,
    title: s.title,
    original_title: s.originalTitle,
    first_air_date: s.firstAirDate,
    overview: s.overview,
    genres: JSON.stringify(s.genres),
    cast_members: JSON.stringify(s.cast),
    follow: s.follow ? 1 : 0,
    note: s.note,
    cover: s.cover,
    banner: s.banner,
    slug: s.slug,
    tags: JSON.stringify(s.tags),
    review: s.review,
    episode_runtime: s.episodeRuntime,
    next_episode_season: s.nextEpisode?.seasonNumber ?? null,
    next_episode_number: s.nextEpisode?.episodeNumber ?? null,
    next_episode_air_date: s.nextEpisode?.airDate ?? null,
    next_episode_name: s.nextEpisode?.name ?? null,
    next_episode_checked_at: s.nextEpisodeCheckedAt,
  };
}

function nextEpisodeFromRow(row: Row): NextEpisode | null {
  const airDate = text(row.next_episode_air_date);
  const seasonNumber = num(row.next_episode_season);
  const episodeNumber = num(row.next_episode_number);
  if (airDate === null || seasonNumber === null || episodeNumber === null) return null;
  return { seasonNumber, episodeNumber, airDate, name: text(row.next_episode_name) };
}

function seriesFromRow(row: Row): Series {
  return {
    id: Number(row.id),
    tmdbId: num(row.tmdb_id),
    tvdbId: num(row.tvdb_id),
    tmdbEpisodeGroup: text(row.tmdb_episode_group),
    jellyfinId: text(row.jellyfin_id),
    title: String(row.title),
    originalTitle: text(row.original_title),
    firstAirDate: text(row.first_air_date),
    overview: text(row.overview),
    genres: parseList(row.genres),
    cast: parseList(row.cast_members),
    follow: Number(row.follow) === 1,
    note: text(row.note),
    cover: text(row.cover),
    banner: text(row.banner),
    slug: text(row.slug),
    tags: parseList(row.tags),
    review: text(row.review),
    episodeRuntime: num(row.episode_runtime),
    nextEpisode: nextEpisodeFromRow(row),
    nextEpisodeCheckedAt: text(row.next_episode_checked_at),
  };
}

export const seriesTable: MediaTableSpec<Series> = {
  table: 'series',
  entryColumns: ENTRY_COLUMNS,
  catalogKeys: [['tmdb_id'], ['tvdb_id']],
  relatedDeletes: RELATED_DELETES,
  ownable: true,
  toRow: seriesToRow,
  fromRow: seriesFromRow,
};
