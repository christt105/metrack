import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { pathFetch } from './support/pathFetch.js';
import { png } from './support/sampleImages.js';

const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/original';
const GRID = 'https://cdn2.steamgriddb.com/grid/a.png';

let api: TestApi;

beforeEach(async () => {
  api = await createTestApi(
    pathFetch({
      [`${TMDB}/movie/603/images`]: {
        posters: [
          { file_path: '/a.jpg', width: 1000, height: 1500, vote_average: 5.2, iso_639_1: 'en' },
        ],
        backdrops: [
          { file_path: '/b.jpg', width: 1920, height: 1080, vote_average: 4, iso_639_1: null },
        ],
      },
      [`${TMDB}/tv/1/season/2/images`]: {
        posters: [{ file_path: '/s2.jpg', width: 500, height: 750 }],
      },
      'https://www.steamgriddb.com/api/v2/grids/game/77': {
        data: [
          {
            url: GRID,
            thumb: 'https://cdn2.steamgriddb.com/thumb/a.png',
            width: 600,
            height: 900,
            score: 3,
          },
        ],
      },
      [`${IMG}/a.jpg`]: png(1000, 1500, 1),
      [`${IMG}/b.jpg`]: png(1920, 1080, 2),
      [`${IMG}/s2.jpg`]: png(500, 750, 3),
      [GRID]: png(600, 900, 4),
    }).fetch,
  );
});

const call = (method: 'GET' | 'PUT' | 'DELETE' | 'PATCH', url: string, payload?: object) =>
  api.app.inject({ method, url, payload });

async function movie(): Promise<number> {
  return (
    await api.app.inject({
      method: 'POST',
      url: '/api/movies',
      payload: { title: 'Matrix', tmdbId: 603 },
    })
  ).json().id;
}

describe('image candidates', () => {
  it('lists TMDB posters for covers and backdrops for banners', async () => {
    const id = await movie();
    const covers = (await call('GET', `/api/movies/${id}/images/cover`)).json();
    expect(covers.failures).toEqual([]);
    expect(covers.candidates).toEqual([
      {
        provider: 'tmdb',
        url: `${IMG}/a.jpg`,
        thumbUrl: 'https://image.tmdb.org/t/p/w342/a.jpg',
        width: 1000,
        height: 1500,
        score: 5.2,
        language: 'en',
      },
    ]);
    const banners = (await call('GET', `/api/movies/${id}/images/banner`)).json();
    expect(banners.candidates[0]).toMatchObject({ url: `${IMG}/b.jpg`, language: null });
  });

  it('lists season posters from the series TMDB id and the TMDB season number', async () => {
    const series = (
      await api.app.inject({
        method: 'POST',
        url: '/api/series',
        payload: { title: 'Lupin', tmdbId: 1 },
      })
    ).json();
    const season = (
      await api.app.inject({
        method: 'POST',
        url: '/api/seasons',
        payload: { seriesId: series.id, number: 4, tmdbSeasonNumber: 2 },
      })
    ).json();
    const covers = (await call('GET', `/api/seasons/${season.id}/images/cover`)).json();
    expect(covers.candidates).toHaveLength(1);
    expect(
      (await call('GET', `/api/seasons/${season.id}/images/banner`)).json().candidates,
    ).toEqual([]);
  });

  it('lists SteamGridDB images for games and nothing for a game without its id', async () => {
    const game = (
      await api.app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { title: 'Hades', steamGridDbId: 77 },
      })
    ).json();
    const covers = (await call('GET', `/api/games/${game.id}/images/cover`)).json();
    expect(covers.candidates[0]).toMatchObject({ provider: 'steamgriddb', url: GRID, score: 3 });
    const bare = (
      await api.app.inject({ method: 'POST', url: '/api/games', payload: { title: 'Other' } })
    ).json();
    expect((await call('GET', `/api/games/${bare.id}/images/cover`)).json().candidates).toEqual([]);
  });

  it('keeps the other providers when one fails', async () => {
    const game = (
      await api.app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { title: 'Hades', steamGridDbId: 404 },
      })
    ).json();
    const result = (await call('GET', `/api/games/${game.id}/images/cover`)).json();
    expect(result.candidates).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].provider).toBe('steamgriddb');
  });

  it('rejects books asking for a banner', async () => {
    const book = (
      await api.app.inject({ method: 'POST', url: '/api/books', payload: { title: 'Dune' } })
    ).json();
    const response = await call('GET', `/api/books/${book.id}/images/banner`);
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('unsupported_image_kind');
    expect((await call('GET', '/api/movies/99/images/cover')).statusCode).toBe(404);
  });
});

describe('choosing and removing images', () => {
  it('downloads the chosen image into the store and protects it from refreshes', async () => {
    const id = await movie();
    const response = await call('PUT', `/api/movies/${id}/images/cover`, { url: `${IMG}/a.jpg` });
    expect(response.statusCode).toBe(200);
    const detail = response.json();
    expect(detail.cover).toMatch(/^\/api\/images\/[0-9a-f]{64}$/);
    expect(detail.editedFields).toContain('cover');
    expect(api.store.list()).toHaveLength(1);
    const served = await call('GET', detail.cover);
    expect(served.rawPayload.equals(png(1000, 1500, 1))).toBe(true);
  });

  it('refuses URLs that no provider owns', async () => {
    const id = await movie();
    for (const url of [
      'http://image.tmdb.org/t/p/original/a.jpg',
      'https://evil.test/a.jpg',
      'not a url',
    ]) {
      const response = await call('PUT', `/api/movies/${id}/images/cover`, { url });
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('url_not_allowed');
    }
    expect(api.store.list()).toEqual([]);
  });

  it('refuses a SteamGridDB image for a movie', async () => {
    const id = await movie();
    expect((await call('PUT', `/api/movies/${id}/images/cover`, { url: GRID })).statusCode).toBe(
      400,
    );
  });

  it('reports a failed download as 502 and leaves the entity alone', async () => {
    const id = await movie();
    const response = await call('PUT', `/api/movies/${id}/images/cover`, {
      url: `${IMG}/missing.jpg`,
    });
    expect(response.statusCode).toBe(502);
    expect(api.movies.get(id)?.cover).toBeNull();
  });

  it('removes an image from the entity and its file from the store', async () => {
    const id = await movie();
    await call('PUT', `/api/movies/${id}/images/cover`, { url: `${IMG}/a.jpg` });
    const response = await call('DELETE', `/api/movies/${id}/images/cover`);
    expect(response.json()).toMatchObject({ cover: null });
    expect(api.store.list()).toEqual([]);
  });

  it('keeps the file when another entity still uses it', async () => {
    const first = await movie();
    const second = (
      await api.app.inject({ method: 'POST', url: '/api/movies', payload: { title: 'Copy' } })
    ).json().id;
    await call('PUT', `/api/movies/${first}/images/cover`, { url: `${IMG}/a.jpg` });
    await call('PUT', `/api/movies/${second}/images/cover`, { url: `${IMG}/a.jpg` });
    await call('DELETE', `/api/movies/${first}/images/cover`);
    expect(api.store.list()).toHaveLength(1);
    expect(api.movies.get(second)?.cover).not.toBeNull();
  });

  it('marks the site dirty after choosing an image', async () => {
    const id = await movie();
    await call('PUT', `/api/movies/${id}/images/cover`, { url: `${IMG}/a.jpg` });
    expect(api.scheduler.pending()).toBe(1);
  });
});
