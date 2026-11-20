import { beforeEach, describe, expect, it } from 'vitest';
import { emptyMovie, emptySeries, emptyVideogame } from '../src/media/emptyEntities.js';
import { SqliteEpisodeWatchRepository } from '../src/storage/sqlite/SqliteEpisodeWatchRepository.js';
import { SqliteSeasonEpisodesRepository } from '../src/storage/sqlite/SqliteSeasonEpisodesRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { insertSeason } from './support/insertSeason.js';
import { pathFetch } from './support/pathFetch.js';

let api: TestApi;
let catalogs: SqliteSeasonEpisodesRepository;
let watches: SqliteEpisodeWatchRepository;

beforeEach(async () => {
  api = await createTestApi(pathFetch({}).fetch);
  catalogs = new SqliteSeasonEpisodesRepository(api.db);
  watches = new SqliteEpisodeWatchRepository(api.db, new AsyncUserScope());
});

const post = (url: string, payload: object) => api.app.inject({ method: 'POST', url, payload });
const patch = (url: string, payload: object) => api.app.inject({ method: 'PATCH', url, payload });
const get = (url: string) => api.app.inject({ method: 'GET', url });

describe('time spent on games and books', () => {
  it('starts as no data and stores whole minutes', async () => {
    const game = await post('/api/games', { title: 'Hades' });
    expect(game.json().timeSpentMinutes).toBeNull();
    const set = await patch(`/api/games/${game.json().id}`, { timeSpentMinutes: 750 });
    expect(set.json().timeSpentMinutes).toBe(750);
    expect((await get(`/api/games/${game.json().id}`)).json().timeSpentMinutes).toBe(750);
    const cleared = await patch(`/api/games/${game.json().id}`, { timeSpentMinutes: null });
    expect(cleared.json().timeSpentMinutes).toBeNull();
  });

  it('accepts a book created with minutes and zero as a real value', async () => {
    const book = await post('/api/books', { title: 'Dune', timeSpentMinutes: 0 });
    expect(book.statusCode).toBe(201);
    expect(book.json().timeSpentMinutes).toBe(0);
  });

  it('accepts the limit and rejects negatives, fractions and anything above 100000 hours', async () => {
    const id = (await post('/api/books', { title: 'Dune' })).json().id;
    expect((await patch(`/api/books/${id}`, { timeSpentMinutes: 6_000_000 })).statusCode).toBe(200);
    for (const bad of [-1, 6_000_001, 1.5]) {
      const response = await patch(`/api/books/${id}`, { timeSpentMinutes: bad });
      expect(response.statusCode, String(bad)).toBe(400);
      expect(response.json().code).toBe('validation_error');
    }
    expect((await post('/api/games', { title: 'x', timeSpentMinutes: -5 })).statusCode).toBe(400);
  });

  it('is not an editable field of movies', async () => {
    const id = (await post('/api/movies', { title: 'Matrix' })).json().id;
    expect((await patch(`/api/movies/${id}`, { timeSpentMinutes: 10 })).statusCode).toBe(400);
    expect((await patch(`/api/movies/${id}`, { runtime: 10 })).statusCode).toBe(400);
  });
});

describe('time spent on a series', () => {
  async function seriesWithCatalog(runtime: number | null) {
    const series = await api.series.create({
      ...emptySeries(),
      title: 'Lupin',
      episodeRuntime: runtime,
    });
    const season = await insertSeason(api, series.id, { number: 1, status: 'in_progress' });
    await catalogs.put({
      seasonId: season.id,
      source: 'tmdb',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      complete: true,
      episodes: [20, 30, null].map((minutes, index) => ({
        number: index + 1,
        title: null,
        airDate: null,
        runtime: minutes,
        tmdbId: 100 + index,
        overview: null,
        stillPath: null,
      })),
    });
    return { series, season };
  }

  it('adds the runtime of every viewing, the season average for a missing one, and skips fillers', async () => {
    const { series, season } = await seriesWithCatalog(null);
    await watches.replace(
      1,
      series.id,
      {
        '100': [
          { startedAt: '2026-01-02', finishedAt: '2026-01-02' },
          { startedAt: '2026-02-02', finishedAt: '2026-02-02' },
        ],
        '102': [],
        '101': [{ startedAt: '2026-01-03', finishedAt: '2026-01-03' }],
      },
      undefined,
      ['101'],
    );
    const expected = 20 + 20 + 25;
    expect((await get(`/api/series/${series.id}`)).json().timeSpentMinutes).toBe(expected);
    expect((await get(`/api/seasons/${season.id}`)).json().timeSpentMinutes).toBe(expected);
  });

  it('is null when nothing was watched or no runtime is known anywhere', async () => {
    const { series } = await seriesWithCatalog(null);
    expect((await get(`/api/series/${series.id}`)).json().timeSpentMinutes).toBeNull();
    const bare = await api.series.create({ ...emptySeries(), title: 'Bare' });
    await insertSeason(api, bare.id, { number: 1, status: 'completed', watchedCount: 4 });
    expect((await get(`/api/series/${bare.id}`)).json().timeSpentMinutes).toBeNull();
  });

  it('falls back to the series runtime without a catalog', async () => {
    const series = await api.series.create({ ...emptySeries(), title: 'Old', episodeRuntime: 45 });
    await insertSeason(api, series.id, {
      number: 1,
      status: 'completed',
      watchedCount: 4,
      finishedAt: '2025-06-01',
    });
    expect((await get(`/api/series/${series.id}`)).json().timeSpentMinutes).toBe(180);
  });
});

describe('the public statistics page', () => {
  async function publish(): Promise<void> {
    const response = await patch('/api/settings/public-page', { handle: 'ana', enabled: true });
    expect(response.statusCode).toBe(200);
  }

  it('shows the hours of movies, games and books, and counts the finished ones without hours', async () => {
    await api.movies.create({
      ...emptyMovie(),
      title: 'Dune',
      status: 'completed',
      finishedAt: '2025-03-05',
      runtime: 120,
      rewatches: [{ startedAt: null, finishedAt: '2026-01-01' }],
    });
    await api.videogames.create({
      ...emptyVideogame(),
      title: 'Hades',
      status: 'completed',
      finishedAt: '2026-02-01',
      timeSpentMinutes: 90 * 60,
    });
    await api.videogames.create({
      ...emptyVideogame(),
      title: 'Celeste',
      status: 'completed',
      finishedAt: '2026-02-02',
    });
    await publish();
    const page = await get('/u/ana/stats/');
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Horas dedicadas');
    expect(page.body).toContain('94,0 h');
    expect(page.body).toContain('Horas por año');
    expect(page.body).toContain('1 juego o libro completado sin horas');
    expect(page.body).toContain('2,0 h');
  });

  it('shows no hours section when nothing has hours', async () => {
    await api.movies.create({ ...emptyMovie(), title: 'Dune', status: 'completed' });
    await publish();
    expect((await get('/u/ana/stats/')).body).not.toContain('Horas dedicadas');
  });
});
