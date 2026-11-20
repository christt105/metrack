import { describe, expect, it } from 'vitest';
import { buildLibrary, englishMessages, renderStats } from '../src/index.js';
import { book, game, input, movie, season, series } from './support.js';

const library = (overrides = {}) =>
  buildLibrary(
    input({
      movies: [
        movie({
          id: 1,
          status: 'completed',
          finishedAt: '2025-03-05',
          runtime: 120,
          rewatches: [{ startedAt: null, finishedAt: '2026-01-01' }],
        }),
        movie({ id: 2, status: 'completed', finishedAt: '2025-04-05' }),
      ],
      series: [series({ id: 1, episodeRuntime: 30 })],
      seasons: [
        season({
          id: 1,
          seriesId: 1,
          number: 1,
          status: 'completed',
          finishedAt: '2024-05-01',
          watchedCount: 4,
        }),
      ],
      videogames: [
        game({ id: 1, status: 'completed', finishedAt: '2026-02-01', timeSpentMinutes: 600 }),
      ],
      books: [book({ id: 1, status: 'completed', finishedAt: '2026-03-01' })],
      ...overrides,
    }),
    englishMessages,
  );

describe('time spent on the public pages', () => {
  it('puts the computed and typed minutes on each entry', () => {
    const built = library();
    expect(built.movies.map((entry) => entry.timeSpent)).toEqual([
      { minutes: 240, byYear: { '2025': 120, '2026': 120 } },
      null,
    ]);
    expect(built.seasons[0]?.timeSpent).toEqual({ minutes: 120, byYear: { '2024': 120 } });
    expect(built.videogames[0]?.timeSpent).toEqual({ minutes: 600, byYear: { '2026': 600 } });
    expect(built.books[0]?.timeSpent).toBeNull();
  });

  it('reads the catalog and the watches of a season', () => {
    const built = library({
      series: [series({ id: 1 })],
      seasons: [season({ id: 1, seriesId: 1, number: 1, status: 'in_progress' })],
      seasonEpisodes: [
        {
          seasonId: 1,
          source: 'tmdb',
          fetchedAt: '2026-01-01T00:00:00.000Z',
          complete: true,
          episodes: [1, 2].map((number) => ({
            number,
            title: null,
            airDate: null,
            runtime: 40,
            tmdbId: number,
            overview: null,
            stillPath: null,
          })),
        },
      ],
      episodeWatches: [
        {
          seriesId: 1,
          watched: { '1': [{ startedAt: null, finishedAt: '2026-05-01' }], '2': [] },
          skipped: [],
        },
      ],
    });
    expect(built.seasons[0]?.timeSpent).toEqual({ minutes: 80, byYear: { '2026': 40 } });
  });

  it('shows the hours per type and per year, and the finished ones missing hours', () => {
    const html = renderStats(library());
    expect(html).toContain('Time spent');
    expect(html).toContain('Hours per year');
    expect(html).toContain('16.0 h');
    expect(html).toContain('4.0 h');
    expect(html).toContain('10.0 h');
    expect(html).toContain('1 completed game or book without hours');
  });

  it('shows a year block with only that year', () => {
    const html = renderStats(library());
    const block = html.slice(html.indexOf('data-stats-year="2026"'));
    expect(block).toContain('12.0 h');
    expect(block).toContain('1 completed game or book without hours');
  });

  it('leaves the section out when there is no data', () => {
    const html = renderStats(library({ movies: [], seasons: [], videogames: [], books: [] }));
    expect(html).not.toContain('Time spent');
  });
});
