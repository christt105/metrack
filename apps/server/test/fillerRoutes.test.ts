import { beforeEach, describe, expect, it } from 'vitest';
import type { FillerPreviewResponse } from '@metrack/domain';
import type { FetchFn } from '../src/http/FetchFn.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';

const row = (cls: string, n: number) =>
  `<tr class="${cls} odd" id="eps-${n}"><td class="Number">${n}</td><td class="Title"><a href="/x">Ep ${n}</a></td></tr>`;

const SHOWS: Record<string, string> = {
  'my-show': ['filler', 'manga_canon', 'mixed_canon/filler', 'filler', 'anime_canon']
    .map((cls, i) => row(cls, i + 1))
    .join('\n'),
  'short-show': [row('filler', 1), row('filler', 2)].join('\n'),
  naruto: [row('filler', 1)].join('\n'),
};

let api: TestApi;
let calls: string[];

const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  calls.push(url.toString());
  expect(new Headers(init?.headers).get('user-agent')).toContain('metrack');
  if (url.hostname !== 'www.animefillerlist.com') return new Response('missing', { status: 404 });
  const slug = url.pathname.replace('/shows/', '');
  const body = SHOWS[slug];
  return new Response(body === undefined ? '<h1>Page not found</h1>' : `<table>${body}</table>`);
}) as FetchFn;

beforeEach(async () => {
  calls = [];
  api = await createTestApi(fetchFn);
});

function addSeries(title: string, counts: number[], originalTitle: string | null = null) {
  const series = Number(
    api.db
      .prepare('INSERT INTO series (title, original_title) VALUES (?, ?)')
      .run(title, originalTitle).lastInsertRowid,
  );
  api.db.prepare('INSERT INTO series_entry (user_id, series_id) VALUES (1, ?)').run(series);
  const seasons = counts.map((count, index) => {
    const season = Number(
      api.db
        .prepare(
          'INSERT INTO season (series_id, number, tmdb_season_number, episode_count) VALUES (?, ?, ?, ?)',
        )
        .run(series, index + 1, index + 1, count).lastInsertRowid,
    );
    api.db.prepare('INSERT INTO season_entry (user_id, season_id) VALUES (1, ?)').run(season);
    api.db
      .prepare(
        "INSERT INTO season_episodes (season_id, episodes, source, fetched_at, complete) VALUES (?, ?, 'tmdb', ?, 1)",
      )
      .run(
        season,
        JSON.stringify(
          Array.from({ length: count }, (_, i) => ({
            number: i + 1,
            title: `T${i + 1}`,
            airDate: '2020-01-01',
            runtime: null,
            tmdbId: season * 100 + i + 1,
            overview: null,
            stillPath: null,
          })),
        ),
        new Date().toISOString(),
      );
    return season;
  });
  return { series, seasons };
}

const preview = (seriesId: number, query = '') =>
  api.app.inject({ method: 'GET', url: `/api/series/${seriesId}/filler${query}` });

describe('GET /api/series/:id/filler', () => {
  it('classifies a two-season series by absolute number, found by its title slug', async () => {
    const { series, seasons } = addSeries('My Show', [3, 2]);
    const response = await preview(series);
    expect(response.statusCode).toBe(200);
    const body = response.json() as FillerPreviewResponse;
    expect(body.slug).toBe('my-show');
    expect(body.sourceUrl).toBe('https://www.animefillerlist.com/shows/my-show');
    expect(body.counts).toEqual({ filler: 2, mixed: 1, mangaCanon: 1, animeCanon: 1 });
    expect(body.episodes.map((e) => [e.seasonId, e.number, e.absoluteNumber, e.category])).toEqual([
      [seasons[0], 1, 1, 'filler'],
      [seasons[0], 2, 2, 'mangaCanon'],
      [seasons[0], 3, 3, 'mixed'],
      [seasons[1], 1, 4, 'filler'],
      [seasons[1], 2, 5, 'animeCanon'],
    ]);
    expect(body.episodes[3]).toMatchObject({ key: String(seasons[1]! * 100 + 1), seasonNumber: 2 });
    expect(calls).toHaveLength(1);
  });

  it('tries the original title when the title is unknown and reports watched and skipped episodes', async () => {
    const { series, seasons } = addSeries('Mi Serie', [3, 2], 'My Show');
    const first = String(seasons[0]! * 100 + 1);
    const second = String(seasons[0]! * 100 + 2);
    await api.app.inject({
      method: 'PATCH',
      url: `/api/seasons/${seasons[0]}/episodes`,
      payload: { op: 'mark', keys: [first], date: null },
    });
    await api.app.inject({
      method: 'PATCH',
      url: `/api/seasons/${seasons[0]}/episodes`,
      payload: { op: 'skip', keys: [second] },
    });
    const body = (await preview(series)).json() as FillerPreviewResponse;
    expect(body.slug).toBe('my-show');
    expect(calls).toHaveLength(2);
    expect(body.episodes[0]).toMatchObject({ watched: true, skipped: false });
    expect(body.episodes[1]).toMatchObject({ watched: false, skipped: true });
    expect(body.episodes[2]).toMatchObject({ watched: false, skipped: false });
  });

  it('uses an explicit slug or address and refuses other hosts', async () => {
    const { series } = addSeries('Anything', [3, 2]);
    const viaUrl = await preview(
      series,
      `?slug=${encodeURIComponent('https://www.animefillerlist.com/shows/my-show')}`,
    );
    expect(viaUrl.statusCode).toBe(200);
    const bad = await preview(
      series,
      `?slug=${encodeURIComponent('https://evil.example/shows/x')}`,
    );
    expect(bad.statusCode).toBe(400);
    expect(bad.json().code).toBe('invalid_filler_slug');
    expect(calls).toHaveLength(1);
  });

  it('answers filler_not_found when the site has no such show', async () => {
    const { series } = addSeries('Unknown Show', [2]);
    const response = await preview(series);
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe('filler_not_found');
    const explicit = await preview(series, '?slug=nope');
    expect(explicit.json().code).toBe('filler_not_found');
  });

  it('refuses with both counts when the totals differ', async () => {
    const { series } = addSeries('Short Show', [3]);
    const response = await preview(series);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'filler_count_mismatch',
      details: { ours: 3, theirs: 2 },
    });
  });

  it('refuses when a season has no complete catalog', async () => {
    const { series, seasons } = addSeries('My Show', [3, 2]);
    api.db.prepare('DELETE FROM season_episodes WHERE season_id = ?').run(seasons[1]!);
    const response = await preview(series);
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('filler_catalog_incomplete');
  });

  it('answers 502 when AnimeFillerList cannot be read and 404 for an unknown series', async () => {
    const down = await createTestApi((async () => new Response('x', { status: 503 })) as FetchFn);
    const id = Number(
      down.db.prepare('INSERT INTO series (title) VALUES (?)').run('My Show').lastInsertRowid,
    );
    down.db.prepare('INSERT INTO series_entry (user_id, series_id) VALUES (1, ?)').run(id);
    const failed = await down.app.inject({ method: 'GET', url: `/api/series/${id}/filler` });
    expect(failed.statusCode).toBe(502);
    expect(failed.json().code).toBe('filler_source_unavailable');
    expect((await preview(9999)).statusCode).toBe(404);
  });

  it('stores the categories and the slug on a successful preview and replaces them on the next', async () => {
    const { series, seasons } = addSeries('My Show', [3, 2]);
    expect((await preview(series)).statusCode).toBe(200);
    const stored = (id: number) =>
      api.db.prepare('SELECT slug, categories FROM season_filler WHERE season_id = ?').get(id) as
        { slug: string; categories: string } | undefined;
    expect(stored(seasons[0]!)).toEqual({
      slug: 'my-show',
      categories: JSON.stringify({
        [seasons[0]! * 100 + 1]: 'filler',
        [seasons[0]! * 100 + 2]: 'mangaCanon',
        [seasons[0]! * 100 + 3]: 'mixed',
      }),
    });
    api.db
      .prepare('UPDATE season_filler SET slug = \'old\', categories = \'{"x":"filler"}\'')
      .run();
    api.db.prepare('DELETE FROM season_filler WHERE season_id = ?').run(seasons[1]!);
    api.db
      .prepare("INSERT INTO season_filler (season_id, slug, categories) VALUES (?, 'old', '{}')")
      .run(seasons[1]!);
    expect((await preview(series)).statusCode).toBe(200);
    expect(JSON.parse(stored(seasons[0]!)!.categories)).toHaveProperty(
      String(seasons[0]! * 100 + 1),
      'filler',
    );
    expect(stored(seasons[1]!)?.slug).toBe('my-show');
  });

  it('does not store anything when the preview fails', async () => {
    const mismatch = addSeries('Short Show', [3]);
    expect((await preview(mismatch.series)).statusCode).toBe(409);
    const missing = addSeries('Unknown Show', [2]);
    expect((await preview(missing.series)).statusCode).toBe(404);
    expect(api.db.prepare('SELECT * FROM season_filler').all()).toEqual([]);
  });

  it('flags the episodes of a season with the stored category and null before any preview', async () => {
    const { series, seasons } = addSeries('My Show', [3, 2]);
    const season = async (id: number) =>
      (
        (await api.app.inject({ method: 'GET', url: `/api/seasons/${id}/episodes` })).json() as {
          episodes: { filler: string | null }[];
        }
      ).episodes.map((episode) => episode.filler);
    expect(await season(seasons[0]!)).toEqual([null, null, null]);
    await preview(series);
    expect(await season(seasons[0]!)).toEqual(['filler', 'mangaCanon', 'mixed']);
    expect(await season(seasons[1]!)).toEqual(['filler', 'animeCanon']);
  });

  it('does not show a series of another user', async () => {
    const { series } = addSeries('My Show', [3, 2]);
    api.db.prepare('DELETE FROM series_entry WHERE series_id = ?').run(series);
    expect((await preview(series)).statusCode).toBe(404);
  });
});
