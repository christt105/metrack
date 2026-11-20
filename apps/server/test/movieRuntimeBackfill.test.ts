import { beforeEach, describe, expect, it } from 'vitest';
import { MovieRuntimeBackfill } from '../src/backfill/MovieRuntimeBackfill.js';
import { MovieRuntimeScheduler } from '../src/backfill/MovieRuntimeScheduler.js';
import { emptyMovie } from '../src/media/emptyEntities.js';
import { TmdbClient } from '../src/providers/tmdb/TmdbClient.js';
import { SqliteMovieRuntimeRepository } from '../src/storage/sqlite/SqliteMovieRuntimeRepository.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { pathFetch } from './support/pathFetch.js';

let api: TestApi;
let repository: SqliteMovieRuntimeRepository;
let requested: string[];
let responses: Record<string, unknown>;
const logs: string[] = [];
const logger = { info: (m: string) => logs.push(m), error: (m: string) => logs.push(m) };

beforeEach(async () => {
  api = await createTestApi(pathFetch({}).fetch);
  repository = new SqliteMovieRuntimeRepository(api.db);
  requested = [];
  responses = {};
  logs.length = 0;
});

function backfill(): MovieRuntimeBackfill {
  const fetchFn = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    requested.push(url.pathname);
    const body = responses[url.pathname];
    return body === undefined ? new Response('gone', { status: 404 }) : Response.json(body);
  }) as typeof fetch;
  return new MovieRuntimeBackfill(
    repository,
    new TmdbClient(fetchFn, { apiKey: 'key', language: 'es-ES' }),
    logger,
  );
}

async function addMovie(title: string, tmdbId: number | null): Promise<number> {
  return (await api.movies.create({ ...emptyMovie(), title, tmdbId })).id;
}

describe('the movie runtime backfill', () => {
  it('stores the runtime of the movies missing one, a batch at a time', async () => {
    const ids = [await addMovie('A', 1), await addMovie('B', 2), await addMovie('C', 3)];
    responses = {
      '/3/movie/1': { id: 1, runtime: 100 },
      '/3/movie/2': { id: 2, runtime: 0 },
      '/3/movie/3': { id: 3, runtime: 90 },
    };
    const job = backfill();
    expect(await job.runBatch(2)).toBe(2);
    expect((await api.movies.get(ids[0] as number))?.runtime).toBe(100);
    expect((await api.movies.get(ids[1] as number))?.runtime).toBe(0);
    expect((await api.movies.get(ids[2] as number))?.runtime).toBeNull();
    expect(await job.runBatch(2)).toBe(1);
    expect(await job.runBatch(2)).toBe(0);
    expect(requested).toHaveLength(3);
  });

  it('skips movies without a TMDB id and leaves a failing movie for the next batch', async () => {
    const lone = await addMovie('Hand made', null);
    const missing = await addMovie('Gone', 7);
    await addMovie('Fine', 8);
    responses = { '/3/movie/8': { id: 8, runtime: 80 } };
    const job = backfill();
    expect(await job.runBatch()).toBe(0);
    expect(logs[0]).toContain(`movie ${missing}`);
    expect(requested).toEqual(['/3/movie/7']);
    expect((await api.movies.get(lone))?.runtime).toBeNull();
    expect((await api.movies.get(missing))?.runtime).toBeNull();
  });

  it('is filled in by a metadata refresh too', async () => {
    const fetchFn = pathFetch({
      'https://api.themoviedb.org/3/movie/603': { id: 603, title: 'Matrix', runtime: 136 },
    }).fetch;
    const other = await createTestApi(fetchFn);
    const movie = await other.movies.create({ ...emptyMovie(), title: 'Matrix', tmdbId: 603 });
    await other.cache.refresh('movie', movie.id, true);
    expect((await other.movies.get(movie.id))?.runtime).toBe(136);
  });

  it('the scheduler runs one batch and survives a failing one', async () => {
    await addMovie('A', 1);
    responses = { '/3/movie/1': { id: 1, runtime: 50 } };
    const scheduler = new MovieRuntimeScheduler(backfill(), logger);
    expect(await scheduler.tick()).toBe(1);
    expect(await scheduler.tick()).toBe(0);
    const broken = new MovieRuntimeScheduler(
      { runBatch: () => Promise.reject(new Error('boom')) } as unknown as MovieRuntimeBackfill,
      logger,
    );
    expect(await broken.tick()).toBe(0);
    expect(logs.at(-1)).toContain('boom');
  });
});
