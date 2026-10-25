import { MEDIA_SORT_FIELDS, MEDIA_STATUSES, MEDIA_TYPES } from '@metrack/domain';
import type { MediaQuery } from '@metrack/domain';
import type { LibraryFilterState } from './LibraryFilterState';

export const LIBRARY_LIMIT = 1000;

export const defaultFilters: LibraryFilterState = {
  q: '',
  type: '',
  status: '',
  sort: 'title',
  order: 'asc',
};

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/** Reads the filters back from a route query, ignoring anything unknown. */
export function filtersFromQuery(query: Record<string, unknown>): LibraryFilterState {
  return {
    q: typeof query.q === 'string' ? query.q : defaultFilters.q,
    type: pick(query.type, MEDIA_TYPES) ?? '',
    status: pick(query.status, MEDIA_STATUSES) ?? '',
    sort: pick(query.sort, MEDIA_SORT_FIELDS) ?? defaultFilters.sort,
    order: query.order === 'desc' ? 'desc' : 'asc',
  };
}

/** The route query that reproduces the filters, leaving out defaults. */
export function filtersToQuery(filters: LibraryFilterState): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.type) query.type = filters.type;
  if (filters.status) query.status = filters.status;
  if (filters.sort !== defaultFilters.sort) query.sort = filters.sort;
  if (filters.order !== defaultFilters.order) query.order = filters.order;
  return query;
}

/**
 * The API query for the filters. Series and the unfiltered view need the season rows too, so the
 * type is only sent for the kinds that never mix with seasons.
 */
export function filtersToMediaQuery(filters: LibraryFilterState): MediaQuery {
  const query: MediaQuery = { sort: filters.sort, order: filters.order, limit: LIBRARY_LIMIT };
  if (filters.q.trim()) query.q = filters.q.trim();
  if (filters.status) query.status = filters.status;
  if (filters.type && filters.type !== 'series') query.type = filters.type;
  return query;
}
