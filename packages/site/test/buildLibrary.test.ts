import { describe, expect, it } from 'vitest';
import { buildLibrary, publishedImageHashes } from '../src/index.js';
import { HASH_A, HASH_B, book, game, input, movie, season, series } from './support.js';

describe('buildLibrary', () => {
  it('leaves out every item pending review', () => {
    const library = buildLibrary(
      input({
        movies: [movie({ id: 1 }), movie({ id: 2, pendingReview: true })],
        videogames: [game({ id: 1, pendingReview: true })],
        books: [book({ id: 1, pendingReview: true }), book({ id: 2 })],
        series: [series({ id: 1 })],
        seasons: [
          season({ id: 1, seriesId: 1 }),
          season({ id: 2, seriesId: 1, number: 2, pendingReview: true }),
        ],
      }),
    );
    expect(library.movies.map((entry) => entry.id)).toEqual([1]);
    expect(library.videogames).toEqual([]);
    expect(library.books.map((entry) => entry.id)).toEqual([2]);
    expect(library.seasons.map((entry) => entry.id)).toEqual([1]);
  });

  it('leaves out a series whose seasons are all pending, but keeps one with no seasons', () => {
    const library = buildLibrary(
      input({
        series: [series({ id: 1 }), series({ id: 2 }), series({ id: 3 })],
        seasons: [
          season({ id: 1, seriesId: 1, pendingReview: true }),
          season({ id: 2, seriesId: 3 }),
        ],
      }),
    );
    expect(library.series.map((entry) => entry.id)).toEqual([2, 3]);
  });

  it('names seasons after their series, and a single season after the series alone', () => {
    const library = buildLibrary(
      input({
        series: [series({ id: 1, title: 'Lupin' }), series({ id: 2, title: 'Dark' })],
        seasons: [
          season({ id: 1, seriesId: 1, number: 1 }),
          season({ id: 2, seriesId: 1, number: 2 }),
          season({ id: 3, seriesId: 2, number: 1 }),
          season({ id: 4, seriesId: 2, number: 1, title: 'Otra' }),
        ],
      }),
    );
    expect(library.seasons.map((entry) => entry.title)).toEqual(
      ['Lupin - Temporada 1', 'Dark - Temporada 1', 'Otra', 'Lupin - Temporada 2'].sort(
        (a, b) =>
          library.seasons.findIndex((e) => e.title === a) -
          library.seasons.findIndex((e) => e.title === b),
      ),
    );
  });

  it('lets seasons without art use their series art', () => {
    const library = buildLibrary(
      input({
        series: [series({ id: 1, cover: 'https://image.tmdb.org/t/p/original/a.jpg' })],
        seasons: [season({ id: 1, seriesId: 1 })],
      }),
    );
    expect(library.seasons[0]?.cover).toBe('https://image.tmdb.org/t/p/original/a.jpg');
  });
});

describe('publishedImageHashes', () => {
  it('collects own covers, banners and images in shown reviews only', () => {
    const library = buildLibrary(
      input({
        movies: [
          movie({
            id: 1,
            cover: `/api/images/${HASH_A}`,
            banner: 'https://image.tmdb.org/t/p/original/b.jpg',
          }),
          movie({ id: 2, pendingReview: true, cover: `/api/images/${HASH_B}` }),
          movie({ id: 3, review: `Mira\n\n![foto](/api/images/${'c'.repeat(64)})` }),
        ],
      }),
    );
    expect([...publishedImageHashes(library)].sort()).toEqual([HASH_A, 'c'.repeat(64)]);
  });
});
