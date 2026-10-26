import type { MediaSortField } from '@metrack/domain';

/** The order a sort starts with when picked: titles from A to Z, everything else newest or highest first. */
export function naturalOrder(sort: MediaSortField): 'asc' | 'desc' {
  return sort === 'title' ? 'asc' : 'desc';
}
