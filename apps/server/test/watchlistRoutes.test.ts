import { beforeEach, describe, expect, it } from 'vitest';
import { emptyMovie, emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { pathFetch } from './support/pathFetch.js';

let api: TestApi;

beforeEach(async () => {
  api = await createTestApi(pathFetch({}).fetch);
});

const call = (method: 'GET' | 'PUT' | 'DELETE', url: string) => api.app.inject({ method, url });

describe('watchlist routes', () => {
  it('follows and unfollows a movie and a series', async () => {
    const movie = api.movies.create({ ...emptyMovie(), title: 'Heat', releaseDate: '1995-12-15' });
    const show = api.series.create({ ...emptySeries(), title: 'Lupin', cover: '/api/images/abc' });
    api.seasons.create({
      ...emptySeason(),
      seriesId: show.id,
      number: 1,
      firstAirDate: '2021-01-08',
    });
    api.seasons.create({
      ...emptySeason(),
      seriesId: show.id,
      number: 2,
      firstAirDate: '2026-10-23',
    });

    expect((await call('GET', '/api/watchlist')).json()).toEqual([]);
    expect((await call('PUT', `/api/watchlist/movies/${movie.id}`)).statusCode).toBe(204);
    expect((await call('PUT', `/api/watchlist/series/${show.id}`)).statusCode).toBe(204);
    expect((await call('GET', '/api/watchlist')).json()).toEqual([
      { type: 'movie', id: movie.id, title: 'Heat', cover: null, releaseDate: '1995-12-15' },
      {
        type: 'series',
        id: show.id,
        title: 'Lupin',
        cover: '/api/images/abc',
        releaseDate: '2026-10-23',
      },
    ]);
    expect(api.movies.get(movie.id)?.follow).toBe(true);

    expect((await call('DELETE', `/api/watchlist/movies/${movie.id}`)).statusCode).toBe(204);
    expect((await call('GET', '/api/watchlist')).json()).toHaveLength(1);
    expect((await call('DELETE', `/api/watchlist/series/${show.id}`)).statusCode).toBe(204);
    expect((await call('GET', '/api/watchlist')).json()).toEqual([]);
  });

  it('answers 404 for an unknown title and 400 for an unknown collection', async () => {
    expect((await call('PUT', '/api/watchlist/movies/99')).statusCode).toBe(404);
    expect((await call('PUT', '/api/watchlist/books/1')).statusCode).toBe(400);
  });

  it('lists sent alerts newest first and honors the limit', async () => {
    for (const [i, kind] of (['releases_tomorrow', 'releases_today'] as const).entries()) {
      api.alerts.record({
        subjectType: 'season',
        subjectId: 1,
        kind,
        title: 'Lupin, season 3',
        message: kind,
        sentAt: `2026-10-2${2 + i}T09:00:00.000Z`,
      });
    }
    const all = (await call('GET', '/api/alerts')).json();
    expect(all.map((a: { kind: string }) => a.kind)).toEqual([
      'releases_today',
      'releases_tomorrow',
    ]);
    expect((await call('GET', '/api/alerts?limit=1')).json()).toHaveLength(1);
    expect((await call('GET', '/api/alerts?limit=0')).statusCode).toBe(400);
  });

  it('records an alert only once per subject and kind', () => {
    const alert = {
      subjectType: 'movie' as const,
      subjectId: 3,
      kind: 'available_es' as const,
      title: 'Heat',
      message: 'm',
      sentAt: '2026-10-23T09:00:00.000Z',
    };
    expect(api.alerts.record(alert)).toBe(true);
    expect(api.alerts.record(alert)).toBe(false);
    expect(api.alerts.keysFor('movie', 3)).toEqual([
      { subjectType: 'movie', subjectId: 3, kind: 'available_es' },
    ]);
  });
});
