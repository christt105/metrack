import { describe, expect, it } from 'vitest';
import type { Movie } from '@metrack/domain';
import { TmdbClient } from '../src/providers/tmdb/TmdbClient.js';
import { TmdbMovieSource } from '../src/providers/tmdb/TmdbMovieSource.js';
import { fakeFetch } from './support/fakeFetch.js';

const movie = { id: 1, tmdbId: 603, title: 'x' } as Movie;
const url =
  'https://api.themoviedb.org/3/movie/603?language=es-ES&append_to_response=credits&api_key=key';

describe('TmdbMovieSource', () => {
  it('maps a TMDB response to movie fields and image URLs', async () => {
    const net = fakeFetch({
      [url]: {
        id: 603,
        title: 'Matrix',
        original_title: 'The Matrix',
        release_date: '1999-03-31',
        overview: 'Line one\nline two',
        poster_path: '/p.jpg',
        backdrop_path: null,
        genres: [{ name: 'Action' }],
        credits: {
          cast: [{ name: 'Keanu', character: 'Neo' }],
          crew: [{ job: 'Director', name: 'Lana' }],
        },
      },
    });
    const source = new TmdbMovieSource(
      new TmdbClient(net.fetch, { apiKey: 'key', language: 'es-ES' }),
    );
    expect(await source.fetch(movie)).toEqual({
      fields: {
        title: 'Matrix',
        originalTitle: 'The Matrix',
        releaseDate: '1999-03-31',
        overview: 'Line one line two',
        genres: ['Action'],
        cast: ['Keanu (Neo)'],
        director: 'Lana',
      },
      coverUrl: 'https://image.tmdb.org/t/p/original/p.jpg',
      bannerUrl: null,
    });
  });

  it('sends long tokens as bearer auth and rejects entities without a TMDB id', async () => {
    const token = 'x'.repeat(50);
    let auth: string | null = null;
    const fetchFn = ((_u: URL, init?: RequestInit) => {
      auth = new Headers(init?.headers).get('Authorization');
      return Promise.resolve(Response.json({ id: 603 }));
    }) as typeof fetch;
    const source = new TmdbMovieSource(
      new TmdbClient(fetchFn, { apiKey: token, language: 'en-US' }),
    );
    await source.fetch(movie);
    expect(auth).toBe(`Bearer ${token}`);
    await expect(source.fetch({ ...movie, tmdbId: null })).rejects.toThrow('no TMDB id');
  });
});
