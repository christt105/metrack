import { describe, expect, it } from 'vitest';
import {
  planSync,
  type LibrarySeason,
  type Season,
  type SeasonChange,
  type Viewing,
} from '../src/index.js';
import { planSeasonChange } from '../src/sync/planSeasonChange.js';

const TODAY = '2026-11-17';

function librarySeason(count: number, numbered = true): LibrarySeason {
  return {
    jellyfinId: 'js1',
    number: 1,
    title: null,
    episodes: Array.from({ length: count }, (_, i) => ({
      jellyfinId: `e${i + 1}`,
      number: numbered ? i + 1 : null,
      airDate: '2025-01-01',
      runtimeSeconds: 1500,
      available: true,
    })),
  };
}

function stored(over: Partial<Season> = {}): Season {
  return {
    id: 5,
    seriesId: 1,
    number: 1,
    tmdbSeasonNumber: null,
    jellyfinId: 'js1',
    title: null,
    overview: null,
    firstAirDate: '2025-01-01',
    episodeCount: 3,
    watchedCount: 0,
    slug: null,
    tags: [],
    cover: null,
    banner: null,
    status: 'planned',
    startedAt: null,
    finishedAt: null,
    rating: null,
    review: null,
    rewatches: [],
    pendingReview: false,
    ...over,
  };
}

const days = (entries: Record<string, string[]>) => new Map(Object.entries(entries));
const view = (finishedAt: string, startedAt: string | null = null): Viewing => ({
  startedAt,
  finishedAt,
});

function plan(
  library: LibrarySeason,
  season: Season | null,
  watchDays: Record<string, string[]>,
  watches?: Record<string, Viewing[]>,
): SeasonChange | null {
  return planSeasonChange(library, season, 'number', {
    watchDays: days(watchDays),
    today: TODAY,
    watches,
  });
}

describe('planSeasonChange episodes', () => {
  it('records one viewing per watched day under the episode number', () => {
    const change = plan(librarySeason(3), stored(), { e2: ['2026-03-01', '2026-04-01'] });
    expect(change?.watches).toEqual({ '2': [view('2026-03-01'), view('2026-04-01')] });
    expect(change).toMatchObject({
      status: 'in_progress',
      startedAt: '2026-03-01',
      watchedEpisodes: 1,
    });
  });

  it('merges with the stored watches and never removes a hand-marked viewing', () => {
    const change = plan(
      librarySeason(3),
      stored({ status: 'in_progress', startedAt: '2026-01-01' }),
      { e2: ['2026-03-01'] },
      { '1': [view('2026-01-01')], '2': [view('2026-02-02')] },
    );
    expect(change?.watches).toEqual({
      '1': [view('2026-01-01')],
      '2': [view('2026-02-02'), view('2026-03-01')],
    });
  });

  it('completes from stored and incoming watches together', () => {
    const change = plan(
      librarySeason(3),
      stored({ status: 'in_progress', startedAt: '2026-01-01' }),
      { e3: ['2026-03-03'] },
      { '1': [view('2026-01-01')], '2': [view('2026-01-02')] },
    );
    expect(change).toMatchObject({
      status: 'completed',
      finishedAt: '2026-03-03',
      completes: true,
      missingRating: true,
    });
  });

  it('emits nothing when the merged watches equal the stored ones', () => {
    const season = stored({ status: 'in_progress', startedAt: '2026-03-01' });
    expect(
      plan(librarySeason(3), season, { e1: ['2026-03-01'] }, { '1': [view('2026-03-01')] }),
    ).toBeNull();
  });

  it('treats a completed season without a row as all watched on an unknown date and fills the dates', () => {
    const season = stored({
      status: 'completed',
      startedAt: '2026-01-01',
      finishedAt: '2026-02-01',
    });
    const change = plan(librarySeason(3), season, { e1: ['2026-01-05'] });
    expect(change?.watches).toEqual({ '1': [view('2026-01-05')], '2': [], '3': [] });
    expect(change?.status).toBe('completed');
    expect(change?.rewatches).toBeUndefined();
  });

  it('opens a rewatch when a completed season has plays after its finish', () => {
    const season = stored({
      status: 'completed',
      startedAt: '2026-01-01',
      finishedAt: '2026-02-01',
    });
    const change = plan(librarySeason(3), season, { e1: ['2026-06-01'] });
    expect(change?.rewatches).toEqual([{ startedAt: '2026-06-01', finishedAt: null }]);
    expect(change?.completes).toBe(false);
  });

  it('closes a rewatch when every episode is played again', () => {
    const season = stored({
      status: 'completed',
      startedAt: '2026-01-01',
      finishedAt: '2026-02-01',
    });
    const change = plan(librarySeason(3), season, {
      e1: ['2026-06-01'],
      e2: ['2026-06-02'],
      e3: ['2026-06-05'],
    });
    expect(change?.rewatches).toEqual([view('2026-06-05', '2026-06-01')]);
  });

  it('expects the library episodes even when the stored count differs (24 in Jellyfin)', () => {
    const library = librarySeason(24);
    const watchDays = Object.fromEntries(
      library.episodes.map((e) => [e.jellyfinId, ['2026-03-01']]),
    );
    const change = plan(library, stored({ episodeCount: 12 }), watchDays);
    expect(change).toMatchObject({ status: 'completed', episodeCount: 24, watchedEpisodes: 24 });
  });

  it('records nothing for episodes without a number', () => {
    expect(plan(librarySeason(3, false), stored(), { e1: ['2026-03-01'] })).toBeNull();
  });

  it('creates a season with its watches', () => {
    const change = plan(librarySeason(3), null, { e1: ['2026-03-01'] });
    expect(change).toMatchObject({ seasonId: null, watches: { '1': [view('2026-03-01')] } });
  });

  it('warns about watched episodes without a number', () => {
    const library = librarySeason(3, false);
    const result = planSync({
      movies: [],
      series: [
        {
          jellyfinId: 's1',
          title: 'Show',
          year: 2025,
          tmdbId: 10,
          tvdbId: null,
          seasons: [library],
        },
      ],
      plays: [
        { itemId: 'e1', playedAt: '2026-03-01T12:00:00Z', watchedSeconds: 1500, title: 'Show' },
      ],
      state: { movies: [], series: [], seasons: [], overrides: [], unlinked: [] },
      today: TODAY,
      timeZone: 'UTC',
    });
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'episode_without_number' })]);
    expect(result.series[0]?.seasons[0]?.watches).toBeUndefined();
  });
});
