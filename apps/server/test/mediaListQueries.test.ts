import { afterAll, describe, expect, it } from 'vitest';
import type { MediaQuery } from '@metrack/domain';
import { buildMediaKinds } from '../src/media/buildMediaKinds.js';
import { emptyMovie, emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import { MediaCatalog } from '../src/media/MediaCatalog.js';
import type { MediaKindSources } from '../src/media/MediaKindSources.js';
import { createBackends } from './support/backends.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import type { StorageBackend } from './support/StorageBackend.js';

const backends = createBackends();

afterAll(async () => {
  for (const backend of backends) await backend.dispose();
});

function counting<T extends object>(target: T, calls: string[], name: string): T {
  return new Proxy(target, {
    get(object, property, receiver) {
      const value: unknown = Reflect.get(object, property, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls.push(`${name}.${String(property)}`);
        return (value as (...a: unknown[]) => unknown).apply(object, args);
      };
    },
  });
}

async function listCalls(
  backend: StorageBackend,
  titles: number,
  query: MediaQuery,
): Promise<number> {
  const repositories = (await backend.open()).repositories(OWNER_SCOPE);
  for (let i = 0; i < titles; i++) {
    await repositories.movies.create({ ...emptyMovie(), title: `Movie ${i}` });
    const series = await repositories.series.create({ ...emptySeries(), title: `Series ${i}` });
    for (const number of [2, 1]) {
      await repositories.seasons.create({
        ...emptySeason(),
        seriesId: series.id,
        number,
        status: number === 1 ? 'in_progress' : 'planned',
      });
    }
  }
  const calls: string[] = [];
  const sources: MediaKindSources = {
    movies: counting(repositories.movies, calls, 'movies'),
    series: counting(repositories.series, calls, 'series'),
    seasons: counting(repositories.seasons, calls, 'seasons'),
    videogames: counting(repositories.videogames, calls, 'videogames'),
    books: counting(repositories.books, calls, 'books'),
    overrides: counting(repositories.overrides, calls, 'overrides'),
  };
  const page = await new MediaCatalog(buildMediaKinds(sources)).list(query);
  expect(page.total).toBeGreaterThan(0);
  return calls.length;
}

const QUERIES: [string, MediaQuery][] = [
  ['unfiltered', {}],
  ['status filter', { status: 'in_progress' }],
  ['recent sort', { sort: 'recent' }],
  ['text search', { q: 'series' }],
  ['seasons only', { type: 'season' }],
];

describe.each(backends)('$name: listing titles', (backend) => {
  it.each(QUERIES)(
    '%s reads storage a constant number of times',
    async (_name, query) => {
      const few = await listCalls(backend, 2, query);
      const many = await listCalls(backend, 8, query);
      expect(many).toBe(few);
      expect(many).toBeLessThanOrEqual(5);
    },
    30_000,
  );
});
