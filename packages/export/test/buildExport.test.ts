import { describe, expect, it } from 'vitest';
import { buildExport } from '../src/buildExport.js';
import type { ExportedFile } from '../src/ExportedFile.js';
import { book, empty, game, movie, season, series } from './support.js';

const text = (files: ExportedFile[], path: string): string => {
  const file = files.find((f) => f.path === path);
  if (file?.kind !== 'text') throw new Error(`no text file ${path}`);
  return file.content;
};

describe('buildExport', () => {
  it('writes a movie with its tracking, review and images in its bundle', () => {
    const cover = {
      ref: '/api/images/c1',
      hash: 'c1',
      extension: 'jpg',
      sourceUrl: 'https://image.tmdb.org/t/p/original/poster.jpg',
    };
    const banner = { ref: '/api/images/b1', hash: 'b1', extension: 'png', sourceUrl: null };
    const files = buildExport({
      ...empty,
      images: [cover, banner],
      movies: [
        movie({
          status: 'completed',
          finishedAt: '2024-03-05',
          rating: 7,
          rewatches: ['2025-01-02'],
          review: 'Great, see [[Alpha (2020)]].',
          cover: cover.ref,
          banner: banner.ref,
          tags: ['cine'],
        }),
      ],
    });
    expect(files.map((f) => f.path)).toEqual([
      'content/movies/Alpha (2020)/b1.png',
      'content/movies/Alpha (2020)/index.md',
      'content/movies/Alpha (2020)/tmdb_poster.jpg',
    ]);
    expect(text(files, 'content/movies/Alpha (2020)/index.md')).toBe(
      [
        '---',
        'banner_image: b1.png',
        'date: 2024-03-05',
        'genres:',
        '  - Drama',
        'image: tmdb_poster.jpg',
        'overview: An overview',
        'rating: "7"',
        'release_date: 2020-05-06',
        'rewatches:',
        '  - 2025-01-02',
        'status: finished',
        'tags:',
        '  - cine',
        'title: Alpha',
        'tmdb_id: 10',
        'type: movie',
        '---',
        '',
        'Great, see [Alpha (2020)]({{< ref "Alpha (2020)" >}}).',
        '',
      ].join('\n'),
    );
  });

  it('puts a lone note-less season on the series page', () => {
    const files = buildExport({
      ...empty,
      series: [series()],
      seasons: [season({ slug: null, status: 'in_progress', review: 'Notes' })],
    });
    expect(files.map((f) => f.path)).toEqual(['content/tv/Show (2019)/index.md']);
    const page = text(files, 'content/tv/Show (2019)/index.md');
    expect(page).toContain('status: in_progress');
    expect(page.endsWith('\nNotes\n')).toBe(true);
  });

  it('gives each season a page linked to the series and keeps the series untracked', () => {
    const files = buildExport({
      ...empty,
      series: [series({ review: 'About the show' })],
      seasons: [
        season({
          id: 2,
          number: 2,
          slug: 'Show - Season 2',
          status: 'completed',
          rating: 6,
          finishedAt: '2024-01-01',
        }),
        season({ id: 1, number: 1 }),
      ],
    });
    expect(files.map((f) => f.path)).toEqual([
      'content/seasons/Show - Season 1/index.md',
      'content/seasons/Show - Season 2/index.md',
      'content/tv/Show (2019)/index.md',
    ]);
    const tv = text(files, 'content/tv/Show (2019)/index.md');
    expect(tv).toContain('seasons:\n  - Show - Season 1\n  - Show - Season 2');
    expect(tv).toContain('status: not_started');
    expect(tv.endsWith('\nAbout the show\n')).toBe(true);
    const second = text(files, 'content/seasons/Show - Season 2/index.md');
    expect(second).toContain('series: Show (2019)');
    expect(second).toContain('season_number: 2');
    expect(second).toContain('rating: "6"');
  });

  it('gives a season without artwork the series cover and banner', () => {
    const image = (hash: string) => ({
      ref: `/api/images/${hash}`,
      hash,
      extension: 'jpg',
      sourceUrl: null,
    });
    const files = buildExport({
      ...empty,
      images: [image('poster'), image('backdrop'), image('own')],
      series: [series({ cover: '/api/images/poster', banner: '/api/images/backdrop' })],
      seasons: [
        season({ id: 1, number: 1, cover: '/api/images/own' }),
        season({ id: 2, number: 2, slug: 'Show - Season 2' }),
      ],
    });
    const first = text(files, 'content/seasons/Show - Season 1/index.md');
    expect(first).toContain('image: own.jpg');
    expect(first).toContain('banner_image: backdrop.jpg');
    const second = text(files, 'content/seasons/Show - Season 2/index.md');
    expect(second).toContain('image: poster.jpg');
    expect(second).toContain('banner_image: backdrop.jpg');
    expect(files.map((f) => f.path)).toContain('content/seasons/Show - Season 2/poster.jpg');
  });

  it('prefixes season names that do not mention their series', () => {
    const files = buildExport({
      ...empty,
      series: [series(), series({ id: 2, tmdbId: 21, title: 'Other', slug: 'Other (2020)' })],
      seasons: [
        season({ id: 1, slug: null, title: 'Temporada 2', number: 2 }),
        season({ id: 2, seriesId: 2, slug: null, title: 'Temporada 2', number: 2 }),
        season({ id: 5, seriesId: 2, slug: 'Other - Season 1', number: 1 }),
        season({ id: 3, slug: null, title: 'Show 3', number: 3 }),
        season({ id: 4, slug: null, title: null, number: 4 }),
      ],
    });
    expect(files.map((f) => f.path).filter((p) => p.startsWith('content/seasons/'))).toEqual([
      'content/seasons/Other (2020) - Temporada 2/index.md',
      'content/seasons/Other - Season 1/index.md',
      'content/seasons/Show (2019) - Season 4/index.md',
      'content/seasons/Show (2019) - Temporada 2/index.md',
      'content/seasons/Show 3/index.md',
    ]);
  });

  it('derives unique names for items that came without one', () => {
    const files = buildExport({
      ...empty,
      movies: [
        movie({ id: 1, slug: null, title: 'Same: Name' }),
        movie({ id: 2, slug: null, title: 'Same: Name' }),
        movie({ id: 3, slug: 'Same Name (2020)' }),
      ],
    });
    expect(files.map((f) => f.path)).toEqual([
      'content/movies/Same Name (2020) (2)/index.md',
      'content/movies/Same Name (2020) (3)/index.md',
      'content/movies/Same Name (2020)/index.md',
    ]);
  });

  it('derives a name instead of using a stored one that is not a safe folder name', () => {
    const files = buildExport({
      ...empty,
      movies: [
        movie({ id: 1, slug: '../../evil', title: 'Evil' }),
        movie({ id: 2, slug: '..', title: 'Dots' }),
        movie({ id: 3, slug: '', title: 'Blank' }),
        movie({ id: 4, slug: 'a\\b', title: 'Slash' }),
      ],
    });
    expect(files.map((f) => f.path)).toEqual([
      'content/movies/Blank (2020)/index.md',
      'content/movies/Dots (2020)/index.md',
      'content/movies/Evil (2020)/index.md',
      'content/movies/Slash (2020)/index.md',
    ]);
  });

  it('never derives a dot name from a title', () => {
    const files = buildExport({
      ...empty,
      videogames: [game({ id: 1, slug: null, title: '..', releaseDate: null })],
      books: [book({ id: 2, slug: null, title: '/', releaseDate: null })],
    });
    expect(files.map((f) => f.path)).toEqual([
      'content/books/untitled (2)/index.md',
      'content/games/untitled/index.md',
    ]);
  });

  it('writes games and books to their sections', () => {
    const files = buildExport({ ...empty, videogames: [game()], books: [book()] });
    expect(text(files, 'content/games/Game/index.md')).toContain('steam_appid: "730"');
    expect(text(files, 'content/games/Game/index.md')).toContain('developer: Dev');
    expect(text(files, 'content/books/Book/index.md')).toContain('author:\n  - A');
  });

  it('is deterministic', () => {
    const input = {
      ...empty,
      movies: [movie({ id: 2, slug: 'B' }), movie({ id: 1, slug: 'A' })],
      series: [series()],
      seasons: [season()],
    };
    expect(buildExport(input)).toEqual(buildExport(structuredClone(input)));
  });
});
