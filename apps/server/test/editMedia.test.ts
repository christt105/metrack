import { beforeEach, describe, expect, it } from 'vitest';
import { pathFetch } from './support/pathFetch.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';

let api: TestApi;

beforeEach(async () => {
  api = await createTestApi(pathFetch({}).fetch);
});

const post = (url: string, payload: object) => api.app.inject({ method: 'POST', url, payload });
const patch = (url: string, payload: object) => api.app.inject({ method: 'PATCH', url, payload });

async function createMovie(extra: object = {}): Promise<number> {
  const response = await post('/api/movies', { title: 'Matrix', ...extra });
  expect(response.statusCode).toBe(201);
  return response.json().id;
}

describe('creating and reading', () => {
  it('creates a movie with defaults and returns its detail', async () => {
    const response = await post('/api/movies', { title: 'Matrix', tmdbId: 603 });
    expect(response.json()).toMatchObject({
      title: 'Matrix',
      tmdbId: 603,
      status: 'planned',
      rewatches: [],
      editedFields: [],
      fetchedAt: null,
    });
    const read = await api.app.inject({ method: 'GET', url: `/api/movies/${response.json().id}` });
    expect(read.json().title).toBe('Matrix');
  });

  it('answers 404 for unknown ids and collections', async () => {
    const missing = await api.app.inject({ method: 'GET', url: '/api/movies/99' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'Not found', code: 'not_found' });
    expect((await api.app.inject({ method: 'GET', url: '/api/nothing' })).statusCode).toBe(404);
  });

  it('rejects invalid bodies with a validation error', async () => {
    const noTitle = await post('/api/movies', {});
    expect(noTitle.statusCode).toBe(400);
    expect(noTitle.json().code).toBe('validation_error');
    expect((await post('/api/movies', { title: 'x', bogus: 1 })).statusCode).toBe(400);
    expect((await post('/api/movies', { title: 'x', rating: 11 })).statusCode).toBe(400);
    expect((await post('/api/movies', { title: 'x', status: 'watching' })).statusCode).toBe(400);
    expect((await post('/api/movies', { title: 'x', startedAt: '2026-13-01' })).statusCode).toBe(
      400,
    );
  });

  it('rejects slugs that are not a single safe folder name', async () => {
    const id = await createMovie();
    for (const slug of ['../..', '..', '.', '/', '', ' ', 'a/b', 'a\\b', '../../etc/passwd']) {
      const created = await post('/api/movies', { title: 'x', slug });
      expect(created.statusCode).toBe(400);
      expect(created.json().code).toBe('validation_error');
      const patched = await patch(`/api/movies/${id}`, { slug });
      expect(patched.statusCode).toBe(400);
      expect(patched.json().code).toBe('validation_error');
    }
  });

  it('accepts slugs like the ones the vault gives', async () => {
    const id = await createMovie();
    for (const slug of ['Amélie (2001)', "Ocean's Eleven (2001)", 'Mr. Robot - Season 1']) {
      const patched = await patch(`/api/movies/${id}`, { slug });
      expect(patched.statusCode).toBe(200);
      expect(patched.json().slug).toBe(slug);
    }
    expect((await patch(`/api/movies/${id}`, { slug: null })).json().slug).toBeNull();
  });

  it('rejects impossible calendar dates', async () => {
    const response = await post('/api/movies', { title: 'x', releaseDate: '2026-02-30' });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('invalid_date');
  });

  it('answers 409 when a unique id is already taken', async () => {
    await createMovie({ tmdbId: 1 });
    const duplicate = await post('/api/movies', { title: 'Other', tmdbId: 1 });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().code).toBe('conflict');
  });

  it('creates a season only under an existing series', async () => {
    const orphan = await post('/api/seasons', { seriesId: 42, number: 1 });
    expect(orphan.statusCode).toBe(400);
    expect(orphan.json().code).toBe('invalid_reference');

    const series = (await post('/api/series', { title: 'Lupin', tmdbId: 1 })).json();
    const season = await post('/api/seasons', { seriesId: series.id, number: 1, title: 'Part 1' });
    expect(season.statusCode).toBe(201);
    expect((await post('/api/seasons', { seriesId: series.id, number: 1 })).statusCode).toBe(409);

    const detail = (
      await api.app.inject({ method: 'GET', url: `/api/series/${series.id}` })
    ).json();
    expect(detail.seasons.map((s: { number: number }) => s.number)).toEqual([1]);
    expect(detail.overrides).toEqual([]);
  });

  it('deletes an entity and cascades from a series to its seasons', async () => {
    const series = (await post('/api/series', { title: 'Lupin' })).json();
    await post('/api/seasons', { seriesId: series.id, number: 1 });
    expect(
      (await api.app.inject({ method: 'DELETE', url: `/api/series/${series.id}` })).statusCode,
    ).toBe(204);
    expect(api.seasons.list()).toEqual([]);
    expect(
      (await api.app.inject({ method: 'DELETE', url: `/api/series/${series.id}` })).statusCode,
    ).toBe(404);
  });
});

describe('editing', () => {
  it('confirms a viewing pending review', async () => {
    const id = await createMovie({ pendingReview: true });
    expect(
      (await api.app.inject({ method: 'GET', url: `/api/movies/${id}` })).json(),
    ).toMatchObject({
      pendingReview: true,
    });
    const response = await patch(`/api/movies/${id}`, { pendingReview: false });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ pendingReview: false });
    const list = (await api.app.inject({ method: 'GET', url: '/api/media' })).json();
    expect(list.items[0]).toMatchObject({ id, pendingReview: false });
  });

  it('edits tracking fields and ids', async () => {
    const id = await createMovie();
    const response = await patch(`/api/movies/${id}`, {
      rating: 8.5,
      review: 'Great',
      note: 'obsidian://x',
      tmdbId: 603,
      jellyfinId: 'jf',
      tags: ['sci-fi'],
      startedAt: '2026-01-01',
    });
    expect(response.json()).toMatchObject({
      rating: 8.5,
      review: 'Great',
      tmdbId: 603,
      jellyfinId: 'jf',
      tags: ['sci-fi'],
      startedAt: '2026-01-01',
    });
  });

  it('applies the domain transition rules to status', async () => {
    const id = await createMovie();
    const started = await patch(`/api/movies/${id}`, { status: 'in_progress' });
    expect(started.json()).toMatchObject({ status: 'in_progress', startedAt: '2026-03-05' });
    const done = await patch(`/api/movies/${id}`, { status: 'completed' });
    expect(done.json()).toMatchObject({ status: 'completed', finishedAt: '2026-03-05' });

    const invalid = await patch(`/api/movies/${id}`, { status: 'paused' });
    expect(invalid.statusCode).toBe(409);
    expect(invalid.json().code).toBe('invalid_transition');
    expect(api.movies.get(id)?.status).toBe('completed');
  });

  it('lets dates sent with a status win over the automatic ones', async () => {
    const id = await createMovie();
    const response = await patch(`/api/movies/${id}`, {
      status: 'completed',
      startedAt: '2025-12-01',
      finishedAt: '2025-12-24',
    });
    expect(response.json()).toMatchObject({ startedAt: '2025-12-01', finishedAt: '2025-12-24' });
  });

  it('does not invent a start date when completing with a past finish date', async () => {
    const id = await createMovie();
    const response = await patch(`/api/movies/${id}`, {
      status: 'completed',
      finishedAt: '2025-12-24',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ startedAt: null, finishedAt: '2025-12-24' });
  });

  it('keeps the first finish and records a rewatch when a finished movie is completed again', async () => {
    const id = await createMovie({
      status: 'completed',
      startedAt: '2026-01-02',
      finishedAt: '2026-01-10',
    });
    const restarted = await patch(`/api/movies/${id}`, { status: 'in_progress' });
    expect(restarted.json()).toMatchObject({ status: 'in_progress', finishedAt: '2026-01-10' });
    const completed = await patch(`/api/movies/${id}`, { status: 'completed' });
    expect(completed.json()).toMatchObject({
      status: 'completed',
      finishedAt: '2026-01-10',
      rewatches: ['2026-03-05'],
    });
  });

  it('rejects a finish date before the start date', async () => {
    const id = await createMovie({ startedAt: '2026-02-01' });
    const response = await patch(`/api/movies/${id}`, { finishedAt: '2026-01-01' });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('invalid_dates');
  });

  it('accepts an empty change and keeps the entity as it was', async () => {
    const id = await createMovie();
    expect((await patch(`/api/movies/${id}`, { status: 'planned' })).statusCode).toBe(200);
    expect((await patch(`/api/movies/${id}`, {})).statusCode).toBe(400);
  });

  it('does not accept fields that do not belong to the collection', async () => {
    const series = (await post('/api/series', { title: 'Lupin' })).json();
    expect((await patch(`/api/series/${series.id}`, { status: 'completed' })).statusCode).toBe(400);
    expect(
      (await patch(`/api/series/${series.id}`, { follow: true, review: 'ok' })).json(),
    ).toMatchObject({
      follow: true,
      review: 'ok',
    });
  });

  it('edits season numbers and the series season overrides', async () => {
    const series = (await post('/api/series', { title: 'Lupin' })).json();
    const season = (await post('/api/seasons', { seriesId: series.id, number: 3 })).json();
    expect(
      (await patch(`/api/seasons/${season.id}`, { number: 4, tmdbSeasonNumber: 3 })).json(),
    ).toMatchObject({
      number: 4,
      tmdbSeasonNumber: 3,
    });

    const put = await api.app.inject({
      method: 'PUT',
      url: `/api/series/${series.id}/overrides/3`,
      payload: { number: 4, title: 'Part 4' },
    });
    expect(put.json()).toEqual({
      seriesId: series.id,
      tmdbSeasonNumber: 3,
      number: 4,
      title: 'Part 4',
      jellyfinSeasonId: null,
    });
    const list = await api.app.inject({ method: 'GET', url: `/api/series/${series.id}/overrides` });
    expect(list.json()).toHaveLength(1);
    expect(
      (await api.app.inject({ method: 'DELETE', url: `/api/series/${series.id}/overrides/3` }))
        .statusCode,
    ).toBe(204);
    expect(
      (await api.app.inject({ method: 'DELETE', url: `/api/series/${series.id}/overrides/3` }))
        .statusCode,
    ).toBe(404);
    expect(
      (await api.app.inject({ method: 'PUT', url: '/api/series/99/overrides/1', payload: {} }))
        .statusCode,
    ).toBe(404);
  });
});

describe('edited fields', () => {
  it('marks changed metadata as edited, but not ids, tracking or unchanged values', async () => {
    const id = await createMovie({ overview: 'Same' });
    const response = await patch(`/api/movies/${id}`, {
      title: 'The Matrix',
      overview: 'Same',
      rating: 9,
      tmdbId: 603,
      genres: ['Action'],
    });
    expect(response.json().editedFields.sort()).toEqual(['genres', 'title']);
  });

  it('unmarks a field so a refresh may overwrite it again', async () => {
    const id = await createMovie();
    await patch(`/api/movies/${id}`, { title: 'Mine' });
    const response = await api.app.inject({
      method: 'DELETE',
      url: `/api/movies/${id}/edited/title`,
    });
    expect(response.json().editedFields).toEqual([]);
    expect(
      (await api.app.inject({ method: 'DELETE', url: `/api/movies/${id}/edited/title` }))
        .statusCode,
    ).toBe(404);
  });

  it('keeps hand edits through a forced refresh', async () => {
    const net = pathFetch({
      'https://api.themoviedb.org/3/movie/603': { id: 603, title: 'Matrix', overview: 'Provider' },
    });
    api = await createTestApi(net.fetch);
    const id = await createMovie({ tmdbId: 603 });
    await patch(`/api/movies/${id}`, { title: 'My title' });

    const refreshed = await post(`/api/metadata/movie/${id}/refresh`, {});
    expect(refreshed.json()).toMatchObject({ outcome: 'updated' });
    expect(api.movies.get(id)).toMatchObject({ title: 'My title', overview: 'Provider' });
  });

  it('refreshes through the API and reports missing entities and sources', async () => {
    expect((await post('/api/metadata/movie/99/refresh', {})).statusCode).toBe(404);
    const season = await post('/api/metadata/season/1/refresh', {});
    expect(season.statusCode).toBe(501);
    expect(season.json().code).toBe('no_metadata_source');
  });
});

describe('rewatches', () => {
  it('records rewatches of completed items only, sorted and without duplicates', async () => {
    const id = await createMovie();
    const early = await post(`/api/movies/${id}/rewatches`, { date: '2026-02-01' });
    expect(early.statusCode).toBe(409);
    expect(early.json().code).toBe('invalid_rewatch');

    await patch(`/api/movies/${id}`, { status: 'completed' });
    await post(`/api/movies/${id}/rewatches`, { date: '2026-02-01' });
    await post(`/api/movies/${id}/rewatches`, { date: '2026-01-01' });
    const last = await post(`/api/movies/${id}/rewatches`, { date: '2026-01-01' });
    expect(last.json().rewatches).toEqual(['2026-01-01', '2026-02-01']);

    const removed = await api.app.inject({
      method: 'DELETE',
      url: `/api/movies/${id}/rewatches/2026-01-01`,
    });
    expect(removed.json().rewatches).toEqual(['2026-02-01']);
    expect(
      (await api.app.inject({ method: 'DELETE', url: `/api/movies/${id}/rewatches/2020-01-01` }))
        .statusCode,
    ).toBe(404);
  });

  it('replaces the whole list through a patch and rejects bad dates', async () => {
    const id = await createMovie();
    expect(
      (await patch(`/api/movies/${id}`, { rewatches: ['2026-02-02', '2026-01-01'] })).json()
        .rewatches,
    ).toEqual(['2026-01-01', '2026-02-02']);
    expect((await patch(`/api/movies/${id}`, { rewatches: ['2026-02-31'] })).statusCode).toBe(400);
  });

  it('has no rewatch routes for series', async () => {
    const series = (await post('/api/series', { title: 'x' })).json();
    expect(
      (await post(`/api/series/${series.id}/rewatches`, { date: '2026-01-01' })).statusCode,
    ).toBe(404);
  });
});

describe('listing', () => {
  beforeEach(async () => {
    await post('/api/movies', {
      title: 'Amélie',
      status: 'completed',
      rating: 9,
      finishedAt: '2026-01-05',
    });
    await post('/api/movies', { title: 'Zodiac', status: 'planned', releaseDate: '2007-03-02' });
    await post('/api/movies', {
      title: 'Blade Runner',
      originalTitle: 'Blade Runner 2049',
      rating: 7,
    });
    await post('/api/games', { title: 'Hades', status: 'in_progress' });
    await post('/api/books', { title: 'Dune', authors: ['Frank Herbert'] });
    const lupin = (await post('/api/series', { title: 'Lupin' })).json();
    await post('/api/seasons', { seriesId: lupin.id, number: 1, status: 'completed' });
    await post('/api/seasons', { seriesId: lupin.id, number: 2, title: 'Second' });
  });

  const list = async (query: string) =>
    (await api.app.inject({ method: 'GET', url: `/api/media${query}` })).json();
  const titles = (page: { items: { title: string }[] }) => page.items.map((i) => i.title);

  it('lists every collection sorted by title', async () => {
    const page = await list('?limit=100');
    expect(page.total).toBe(8);
    expect(titles(page)).toEqual([
      'Amélie',
      'Blade Runner',
      'Dune',
      'Hades',
      'Lupin',
      'Season 1',
      'Second',
      'Zodiac',
    ]);
  });

  it('filters by type and by status, where a series matches through its seasons', async () => {
    expect(titles(await list('?type=movie'))).toEqual(['Amélie', 'Blade Runner', 'Zodiac']);
    expect(titles(await list('?status=completed'))).toEqual(['Amélie', 'Lupin', 'Season 1']);
    expect(titles(await list('?type=videogame'))).toEqual(['Hades']);
  });

  it('searches titles ignoring case and accents, including original titles', async () => {
    expect(titles(await list('?q=amelie'))).toEqual(['Amélie']);
    expect(titles(await list('?q=2049'))).toEqual(['Blade Runner']);
    expect(titles(await list('?q=lupin'))).toEqual(['Lupin', 'Season 1', 'Second']);
  });

  it('sorts with missing values last and paginates', async () => {
    expect(titles(await list('?type=movie&sort=rating&order=desc'))).toEqual([
      'Amélie',
      'Blade Runner',
      'Zodiac',
    ]);
    expect(titles(await list('?type=movie&sort=rating&order=asc'))).toEqual([
      'Blade Runner',
      'Amélie',
      'Zodiac',
    ]);
    const page = await list('?sort=title&limit=2&offset=2');
    expect(titles(page)).toEqual(['Dune', 'Hades']);
    expect(page.total).toBe(8);
  });

  it('sorts by recent activity: in progress first, then the latest tracked day', async () => {
    const season = (await list('?q=season 1')).items[0];
    await patch(`/api/seasons/${season.id}`, { finishedAt: '2026-02-01' });
    expect(titles(await list('?sort=recent&limit=100'))).toEqual([
      'Hades',
      'Lupin',
      'Season 1',
      'Amélie',
      'Blade Runner',
      'Dune',
      'Second',
      'Zodiac',
    ]);
    const amelie = (await list('?q=amelie')).items[0];
    await post(`/api/movies/${amelie.id}/rewatches`, { date: '2026-03-10' });
    expect(titles(await list('?sort=recent&limit=3'))).toEqual(['Hades', 'Amélie', 'Lupin']);
    expect(titles(await list('?sort=recent&order=asc&limit=3'))).toEqual([
      'Hades',
      'Lupin',
      'Season 1',
    ]);
  });

  it('summarizes seasons with their series and series with a season count', async () => {
    const page = await list('?q=lupin&sort=id');
    expect(page.items.find((i: { type: string }) => i.type === 'series')).toMatchObject({
      seasonCount: 2,
      status: null,
    });
    expect(page.items.find((i: { title: string }) => i.title === 'Season 1')).toMatchObject({
      seriesTitle: 'Lupin',
      status: 'completed',
    });
  });

  it('rejects unknown query values', async () => {
    expect((await api.app.inject({ method: 'GET', url: '/api/media?sort=color' })).statusCode).toBe(
      400,
    );
    expect((await api.app.inject({ method: 'GET', url: '/api/media?limit=0' })).statusCode).toBe(
      400,
    );
  });
});

describe('publishing', () => {
  it('marks the site dirty after a successful write but not after reads or failures', async () => {
    await api.app.inject({ method: 'GET', url: '/api/media' });
    await post('/api/movies', {});
    expect(api.scheduler.pending()).toBe(0);
    await post('/api/movies', { title: 'x' });
    expect(api.scheduler.pending()).toBe(1);
  });
});
