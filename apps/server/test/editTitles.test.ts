import { beforeEach, describe, expect, it } from 'vitest';
import { emptyMovie, emptyVideogame } from '../src/media/emptyEntities.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { pathFetch } from './support/pathFetch.js';
import { png } from './support/sampleImages.js';

const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/original';

let api: TestApi;

beforeEach(async () => {
  api = await createTestApi(
    pathFetch({
      [`${TMDB}/search/movie`]: {
        results: [
          {
            id: 603,
            title: 'Matrix',
            original_title: 'The Matrix',
            release_date: '1999-03-31',
            overview: 'Neo',
            poster_path: '/p.jpg',
          },
          { id: 604, title: 'Reloaded', release_date: '2003-05-15' },
        ],
      },
      [`${TMDB}/search/tv`]: { results: [{ id: 1, name: 'Lupin', first_air_date: '2021-01-08' }] },
      [`${TMDB}/movie/603`]: {
        id: 603,
        title: 'Matrix',
        original_title: 'The Matrix',
        release_date: '1999-03-31',
        poster_path: '/p.jpg',
        genres: [{ name: 'Action' }],
      },
      [`${TMDB}/tv/1`]: {
        id: 1,
        name: 'Lupin',
        poster_path: '/lupin.jpg',
        seasons: [
          { season_number: 0, name: 'Specials' },
          {
            season_number: 1,
            name: 'Part 1',
            episode_count: 5,
            air_date: '2021-01-08',
            poster_path: '/s1.jpg',
          },
          { season_number: 2, name: 'Part 2', episode_count: 5 },
        ],
      },
      [`${IMG}/p.jpg`]: png(500, 750, 1),
      [`${IMG}/lupin.jpg`]: png(500, 750, 2),
      [`${IMG}/s1.jpg`]: png(500, 750, 3),
    }).fetch,
  );
});

const get = (url: string) => api.app.inject({ method: 'GET', url });
const post = (url: string, payload: object) => api.app.inject({ method: 'POST', url, payload });

describe('search', () => {
  it('searches TMDB and flags titles that are already in the tracker', async () => {
    api.movies.create({ ...emptyMovie(), tmdbId: 603, title: 'Matrix' });
    const response = await get('/api/search?type=movie&q=matrix&year=1999');
    expect(response.statusCode).toBe(200);
    expect(response.json().results).toEqual([
      {
        type: 'movie',
        provider: 'tmdb',
        externalId: '603',
        title: 'Matrix',
        originalTitle: 'The Matrix',
        year: 1999,
        overview: 'Neo',
        posterUrl: 'https://image.tmdb.org/t/p/w185/p.jpg',
        existingId: 1,
      },
      expect.objectContaining({ externalId: '604', year: 2003, existingId: null }),
    ]);
  });

  it('searches series', async () => {
    const response = await get('/api/search?type=series&q=lupin');
    expect(response.json().results[0]).toMatchObject({ title: 'Lupin', year: 2021 });
  });

  it('answers 501 for providers that are not available and 400 for bad queries', async () => {
    const response = await get('/api/search?type=videogame&q=hades');
    expect(response.statusCode).toBe(501);
    expect(response.json().code).toBe('provider_not_configured');
    expect((await get('/api/search?type=movie')).statusCode).toBe(400);
    expect((await get('/api/search?type=season&q=x')).statusCode).toBe(400);
  });

  it('reports a provider failure as 502', async () => {
    api = await createTestApi((() =>
      Promise.resolve(new Response('no', { status: 500 }))) as typeof fetch);
    expect((await get('/api/search?type=movie&q=x')).statusCode).toBe(502);
  });
});

describe('adding titles', () => {
  it('adds a movie with its metadata and cover', async () => {
    const response = await post('/api/titles', { type: 'movie', externalId: '603' });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ type: 'movie', id: 1 });
    const movie = (await get('/api/movies/1')).json();
    expect(movie).toMatchObject({
      tmdbId: 603,
      title: 'Matrix',
      genres: ['Action'],
      status: 'planned',
    });
    expect(movie.cover).toMatch(/^\/api\/images\/[0-9a-f]{64}$/);
    expect((await get(movie.cover)).statusCode).toBe(200);
  });

  it('adds a series with one planned season per TMDB season, skipping specials', async () => {
    const response = await post('/api/titles', { type: 'series', externalId: '1' });
    expect(response.statusCode).toBe(201);
    const detail = (await get('/api/series/1')).json();
    expect(detail.title).toBe('Lupin');
    expect(detail.seasons).toMatchObject([
      {
        number: 1,
        tmdbSeasonNumber: 1,
        title: 'Part 1',
        episodeCount: 5,
        firstAirDate: '2021-01-08',
        status: 'planned',
      },
      { number: 2, title: 'Part 2', cover: null },
    ]);
    expect(detail.seasons[0].cover).toMatch(/^\/api\/images\//);
  });

  it('refuses a title that is already added and a title the provider does not know', async () => {
    await post('/api/titles', { type: 'movie', externalId: '603' });
    const duplicate = await post('/api/titles', { type: 'movie', externalId: '603' });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: 'already_added', details: { existingId: 1 } });
    expect((await post('/api/titles', { type: 'movie', externalId: '999' })).statusCode).toBe(404);
    expect((await post('/api/titles', { type: 'movie', externalId: 'abc' })).statusCode).toBe(400);
    expect((await post('/api/titles', { type: 'book', externalId: 'OL1' })).statusCode).toBe(501);
  });
});

describe('unlinked inbox', () => {
  const unlink = (mediaType: 'movie' | 'series' | 'season' | 'videogame' | 'book', title: string) =>
    api.unlinked.create({
      mediaType,
      title,
      year: null,
      source: 'import',
      sourceRef: title,
      createdAt: 'now',
    });

  it('lists and dismisses unlinked titles', async () => {
    const row = unlink('movie', 'Mystery');
    expect((await get('/api/unlinked')).json()).toHaveLength(1);
    expect(
      (await api.app.inject({ method: 'DELETE', url: `/api/unlinked/${row.id}` })).statusCode,
    ).toBe(204);
    expect(
      (await api.app.inject({ method: 'DELETE', url: `/api/unlinked/${row.id}` })).statusCode,
    ).toBe(404);
  });

  it('resolves a movie by TMDB id through the provider and removes it from the inbox', async () => {
    const row = unlink('movie', 'Matrx');
    const response = await post(`/api/unlinked/${row.id}/resolve`, {
      ids: { tmdbId: 603, jellyfinId: 'jf1' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ type: 'movie', id: 1 });
    expect(api.movies.get(1)).toMatchObject({ title: 'Matrix', tmdbId: 603, jellyfinId: 'jf1' });
    expect(api.unlinked.list()).toEqual([]);
  });

  it('resolves a game from its own title and the ids given', async () => {
    const row = unlink('videogame', 'Hades');
    const response = await post(`/api/unlinked/${row.id}/resolve`, {
      ids: { igdbId: 113112, steamAppId: '1145360' },
    });
    expect(response.json()).toMatchObject({ type: 'videogame', refresh: null });
    expect(api.videogames.list()[0]).toMatchObject({
      title: 'Hades',
      igdbId: 113112,
      steamAppId: '1145360',
    });
    expect(api.unlinked.list()).toEqual([]);
  });

  it('keeps the title in the inbox when resolving fails', async () => {
    const row = unlink('videogame', 'Hades');
    api.videogames.create({ ...emptyVideogame(), igdbId: 5, title: 'Taken' });
    expect((await post(`/api/unlinked/${row.id}/resolve`, { ids: { igdbId: 5 } })).statusCode).toBe(
      409,
    );
    expect(api.unlinked.list()).toHaveLength(1);
  });

  it('rejects ids that do not apply, missing ids, seasons and unknown titles', async () => {
    const movie = unlink('movie', 'x');
    const none = await post(`/api/unlinked/${movie.id}/resolve`, { ids: {} });
    expect(none.json().code).toBe('ids_required');
    const wrong = await post(`/api/unlinked/${movie.id}/resolve`, { ids: { igdbId: 1 } });
    expect(wrong.json().code).toBe('invalid_ids');
    const season = unlink('season', 's');
    expect(
      (await post(`/api/unlinked/${season.id}/resolve`, { ids: { tmdbId: 1 } })).json().code,
    ).toBe('cannot_resolve');
    expect((await post('/api/unlinked/99/resolve', { ids: { tmdbId: 1 } })).statusCode).toBe(404);
  });
});
