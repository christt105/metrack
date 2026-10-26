import { describe, expect, it } from 'vitest';
import {
  defaultFilters,
  filtersFromQuery,
  filtersToMediaQuery,
  filtersToQuery,
} from '../src/logic/filterQuery';
import { naturalOrder } from '../src/logic/naturalOrder';

describe('filter query', () => {
  it('round trips through the route query and leaves defaults out', () => {
    expect(filtersToQuery(defaultFilters)).toEqual({});
    const filters = {
      q: 'lupin',
      type: 'series',
      status: 'completed',
      sort: 'rating',
      order: 'desc',
    } as const;
    expect(filtersFromQuery(filtersToQuery(filters))).toEqual(filters);
  });

  it('ignores unknown values', () => {
    expect(filtersFromQuery({ type: 'x', status: 'y', sort: 'z', order: 'up' })).toEqual(
      defaultFilters,
    );
  });

  it('only sends the type when it never mixes with seasons', () => {
    expect(filtersToMediaQuery({ ...defaultFilters, type: 'series' }).type).toBeUndefined();
    expect(filtersToMediaQuery({ ...defaultFilters, type: 'book' }).type).toBe('book');
    expect(filtersToMediaQuery({ ...defaultFilters, q: ' x ' }).q).toBe('x');
  });
});

describe('naturalOrder', () => {
  it('starts titles from A and everything else from the newest or highest', () => {
    expect(naturalOrder('title')).toBe('asc');
    expect(naturalOrder('recent')).toBe('desc');
    expect(naturalOrder('rating')).toBe('desc');
  });
});
