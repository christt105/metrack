import { describe, expect, it } from 'vitest';
import {
  collapseUndatedViewing,
  hasCollapsibleViewings,
  reopenCompletedSeason,
  mergeEpisodeWatches,
  planSync,
  type EpisodeWatches,
  type LibraryEpisode,
  type LibrarySeason,
  type Season,
  type Series,
  type SeriesIndex,
  type SeriesWatches,
  type Viewing,
} from '../src/index.js';

const TODAY = '2026-11-17';
const view = (day: string): Viewing => ({ startedAt: day, finishedAt: day });
const undated: Viewing = { startedAt: null, finishedAt: null };

function series(over: Partial<Series> = {}): Series {
  return {
    id: 1,
    tmdbId: 10,
    tvdbId: null,
    tmdbEpisodeGroup: null,
    jellyfinId: 'js',
    title: 'Show',
    originalTitle: null,
    firstAirDate: null,
    overview: null,
    genres: [],
    cast: [],
    follow: false,
    note: null,
    slug: null,
    tags: [],
    review: null,
    nextEpisode: null,
    nextEpisodeCheckedAt: null,
    episodeRuntime: null,
    cover: null,
    banner: null,
    ...over,
  };
}

function season(over: Partial<Season> = {}): Season {
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
    skippedCount: 0,
    wantsRewatch: false,
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

function episode(number: number, over: Partial<LibraryEpisode> = {}): LibraryEpisode {
  return {
    jellyfinId: `e${number}`,
    number,
    name: `Episode ${number}`,
    airDate: null,
    runtimeSeconds: 1500,
    available: true,
    tvdbId: null,
    tmdbId: null,
    ...over,
  };
}

function lib(number: number, episodes: LibraryEpisode[]): LibrarySeason {
  return { jellyfinId: `js${number}`, number, title: null, episodes };
}

function index(counts: number[], over: Partial<SeriesIndex> = {}): SeriesIndex {
  let id = 100;
  const episodes = counts.flatMap((count, s) =>
    Array.from({ length: count }, (_, i) => ({
      tmdbId: ++id,
      seasonNumber: s + 1,
      number: i + 1,
      airDate: null,
    })),
  );
  return {
    tmdbId: 10,
    name: 'Show',
    foreignEpisodes: {},
    episodeIds: {},
    seasons: counts.map((_, s) => ({ number: s + 1, title: null, firstAirDate: null })),
    episodes,
    ...over,
  };
}

interface Run {
  seasons: LibrarySeason[];
  days: Record<string, string[]>;
  index: SeriesIndex;
  stored?: Season[];
  watches?: SeriesWatches['watched'];
  unmatched?: SeriesWatches['unmatched'];
}

function run(input: Run) {
  const watches: SeriesWatches[] =
    input.watches || input.unmatched
      ? [
          {
            seriesId: 1,
            watched: input.watches ?? {},
            skipped: [],
            ...(input.unmatched ? { unmatched: input.unmatched } : {}),
          },
        ]
      : [];
  return planSync({
    movies: [],
    series: [
      {
        jellyfinId: 'js',
        title: 'Show',
        year: 2025,
        tmdbId: 10,
        tvdbId: null,
        seasons: input.seasons,
      },
    ],
    plays: Object.entries(input.days).flatMap(([itemId, days]) =>
      days.map((day) => ({
        itemId,
        playedAt: `${day}T12:00:00Z`,
        watchedSeconds: 1500,
        title: 'Show',
      })),
    ),
    state: {
      movies: [],
      series: [series()],
      seasons: input.stored ?? [],
      unlinked: [],
      watches,
    },
    indexes: new Map([['js', input.index]]),
    today: TODAY,
    timeZone: 'UTC',
  });
}

describe('matching by the TMDB id Jellyfin gives', () => {
  it('records the episode under that id without any TheTVDB lookup', () => {
    const idx = index([3]);
    const plan = run({
      seasons: [lib(1, [episode(1, { tmdbId: 102 }), episode(2), episode(3)])],
      days: { e1: ['2026-03-01'] },
      index: idx,
    });
    expect(plan.series[0]?.watches).toEqual({ '102': [view('2026-03-01')] });
    expect(plan.series[0]?.unmatched).toBeUndefined();
  });

  it('wins over the TheTVDB id', () => {
    const idx = index([3], { episodeIds: { '9': 103 } });
    const plan = run({
      seasons: [lib(1, [episode(1, { tmdbId: 101, tvdbId: 9 }), episode(2), episode(3)])],
      days: { e1: ['2026-03-01'] },
      index: idx,
    });
    expect(Object.keys(plan.series[0]?.watches ?? {})).toEqual(['101']);
  });

  it('matches the case where TMDB does not know the TheTVDB id and every episode shares an air date', () => {
    const base = index([3]);
    const idx = {
      ...base,
      episodes: base.episodes.map((e) => ({ ...e, airDate: '2025-01-01' })),
    };
    const plan = run({
      seasons: [
        lib(1, [
          episode(1, { tmdbId: 101, tvdbId: 11, airDate: '2025-01-01' }),
          episode(2, { tmdbId: 102, tvdbId: 12, airDate: '2025-01-01' }),
          episode(3, { tmdbId: 103, tvdbId: 13, airDate: '2025-01-01' }),
        ]),
      ],
      days: { e1: ['2026-03-01'] },
      index: idx,
    });
    expect(plan.series[0]?.watches).toEqual({ '101': [view('2026-03-01')] });
    expect(plan.warnings).toEqual([]);
  });

  it('ignores an id the ordering does not have and falls back to the TheTVDB id', () => {
    const idx = index([3], { episodeIds: { '9': 103 } });
    const plan = run({
      seasons: [lib(1, [episode(1, { tmdbId: 99999, tvdbId: 9 }), episode(2), episode(3)])],
      days: { e1: ['2026-03-01'] },
      index: idx,
    });
    expect(Object.keys(plan.series[0]?.watches ?? {})).toEqual(['103']);
  });

  it('still reports an episode TMDB places in another series without the id', () => {
    const idx = index([3], { foreignEpisodes: { '9': { showId: 77, showName: 'Other' } } });
    const plan = run({
      seasons: [lib(1, [episode(1, { tvdbId: 9 }), episode(2), episode(3)])],
      days: { e1: ['2026-03-01'] },
      index: idx,
    });
    expect(plan.series[0]?.unmatched).toEqual([
      { code: 'episode_other_series', season: 1, number: 1, name: 'Episode 1', tmdbSeriesId: 77 },
    ]);
    expect(plan.warnings.map((w) => w.code)).toContain('episode_other_series');
  });
});

describe('matching by position', () => {
  it('matches a season whose episode count equals the ordering season, by index', () => {
    const idx = index([3, 2]);
    const plan = run({
      seasons: [
        lib(1, [episode(1), episode(2), episode(3)]),
        lib(2, [episode(1, { jellyfinId: 'x1' }), episode(2, { jellyfinId: 'x2' })]),
      ],
      days: { e2: ['2026-03-01'], x1: ['2026-03-02'] },
      index: idx,
    });
    expect(plan.series[0]?.watches).toEqual({
      '102': [view('2026-03-01')],
      '104': [view('2026-03-02')],
    });
    expect(plan.warnings.map((w) => w.code)).not.toContain('episode_unmatched');
  });

  it('matches by index even when the library numbering is offset', () => {
    const idx = index([3]);
    const plan = run({
      seasons: [lib(1, [episode(11), episode(12), episode(13)])],
      days: { e12: ['2026-03-01'] },
      index: idx,
    });
    expect(plan.series[0]?.watches).toEqual({ '102': [view('2026-03-01')] });
  });

  it('matches by absolute position when the season counts differ but the totals are equal', () => {
    const idx = index([2, 3]);
    const plan = run({
      seasons: [
        lib(1, [episode(1), episode(2), episode(3)]),
        lib(2, [episode(1, { jellyfinId: 'x1' }), episode(2, { jellyfinId: 'x2' })]),
      ],
      days: { e3: ['2026-03-01'], x1: ['2026-03-02'] },
      index: idx,
    });
    expect(plan.series[0]?.watches).toEqual({
      '103': [view('2026-03-01')],
      '104': [view('2026-03-02')],
    });
  });

  it('does not match when neither the season nor the total counts agree', () => {
    const idx = index([2, 3]);
    const plan = run({
      seasons: [
        lib(1, [episode(1), episode(2), episode(3)]),
        lib(2, [episode(1, { jellyfinId: 'x1' })]),
      ],
      days: { e1: ['2026-03-01'] },
      index: idx,
    });
    expect(plan.series[0]?.watches).toBeUndefined();
    expect(plan.series[0]?.unmatched).toEqual([
      { code: 'episode_unmatched', season: 1, number: 1, name: 'Episode 1' },
    ]);
    expect(plan.warnings.map((w) => w.code)).toContain('episode_unmatched');
  });

  it('counts only aired episodes of the ordering for the total', () => {
    const base = index([2, 3]);
    const idx = {
      ...base,
      episodes: base.episodes.map((e, i, all) =>
        i === all.length - 1 ? { ...e, airDate: '2999-01-01' } : e,
      ),
    };
    const plan = run({
      seasons: [
        lib(1, [episode(1), episode(2), episode(3)]),
        lib(2, [episode(1, { jellyfinId: 'x1' })]),
      ],
      days: { e3: ['2026-03-01'] },
      index: idx,
    });
    expect(plan.series[0]?.watches).toEqual({ '103': [view('2026-03-01')] });
  });

  it('never overrides an id match', () => {
    const idx = index([3]);
    const plan = run({
      seasons: [lib(1, [episode(1), episode(2, { tmdbId: 101 }), episode(3)])],
      days: { e1: ['2026-03-01'], e2: ['2026-03-02'] },
      index: idx,
    });
    expect(plan.series[0]?.watches).toEqual({ '101': [view('2026-03-02')] });
    expect(plan.series[0]?.unmatched).toEqual([
      { code: 'episode_unmatched', season: 1, number: 1, name: 'Episode 1' },
    ]);
  });

  it('is skipped for library episodes without a number', () => {
    const idx = index([3]);
    const plan = run({
      seasons: [lib(1, [episode(1), episode(2), { ...episode(3), number: null }])],
      days: { e1: ['2026-03-01'] },
      index: idx,
    });
    expect(plan.series[0]?.watches).toBeUndefined();
  });
});

describe('unmatched episodes in the plan', () => {
  const unmatched = [
    { code: 'episode_unmatched' as const, season: 1, number: 1, name: 'Episode 1' },
  ];

  it('is not repeated when the stored list is the same', () => {
    const idx = index([2, 3]);
    const plan = run({
      seasons: [
        lib(1, [episode(1), episode(2), episode(3)]),
        lib(2, [episode(1, { jellyfinId: 'x1' })]),
      ],
      days: { e1: ['2026-03-01'] },
      index: idx,
      unmatched,
    });
    expect(plan.series).toEqual([]);
  });

  it('clears the stored list with an empty one once everything matches', () => {
    const idx = index([3]);
    const plan = run({
      seasons: [lib(1, [episode(1, { tmdbId: 101 }), episode(2), episode(3)])],
      days: { e1: ['2026-03-01'] },
      index: idx,
      watches: { '101': [view('2026-03-01')] },
      unmatched,
    });
    expect(plan.series[0]?.unmatched).toEqual([]);
  });
});

describe('undated first viewing', () => {
  const idx = index([3]);
  const seasons = [lib(1, [episode(1, { tmdbId: 101 }), episode(2), episode(3)])];

  it('is replaced by the first dated Jellyfin viewing', () => {
    const plan = run({
      seasons,
      days: { e1: ['2026-01-05', '2026-02-01'] },
      index: idx,
      stored: [season({ status: 'completed', finishedAt: '2026-01-10', watchedCount: 3 })],
      watches: { '101': [undated], '102': [undated], '103': [undated] },
    });
    expect(plan.series[0]?.watches?.['101']).toEqual([view('2026-01-05'), view('2026-02-01')]);
    expect(plan.series[0]?.watches?.['102']).toEqual([undated]);
  });

  it('keeps the undated viewing when the dated one is after the season finish', () => {
    const plan = run({
      seasons,
      days: { e1: ['2026-02-01'] },
      index: idx,
      stored: [season({ status: 'completed', finishedAt: '2026-01-10', watchedCount: 3 })],
      watches: { '101': [undated], '102': [undated], '103': [undated] },
    });
    expect(plan.series[0]?.watches?.['101']).toEqual([undated, view('2026-02-01')]);
  });

  it('replaces it when the season has no finish', () => {
    const plan = run({
      seasons,
      days: { e1: ['2026-02-01'] },
      index: idx,
      stored: [season({ status: 'in_progress', finishedAt: null })],
      watches: { '101': [] },
    });
    expect(plan.series[0]?.watches?.['101']).toEqual([view('2026-02-01')]);
  });

  it('heals an episode already stored as undated and dated', () => {
    const plan = run({
      seasons,
      days: { e1: ['2026-01-05'] },
      index: idx,
      stored: [season({ status: 'completed', finishedAt: '2026-01-10', watchedCount: 3 })],
      watches: { '101': [undated, view('2026-01-05')], '102': [undated], '103': [undated] },
    });
    expect(plan.series[0]?.watches?.['101']).toEqual([view('2026-01-05')]);
  });

  it('derives the season dates from the episodes once every first viewing is dated', () => {
    const plan = run({
      seasons: [
        lib(1, [
          episode(1, { tmdbId: 101 }),
          episode(2, { tmdbId: 102 }),
          episode(3, { tmdbId: 103 }),
        ]),
      ],
      days: { e1: ['2026-01-02'], e2: ['2026-01-03'], e3: ['2026-01-05'] },
      index: idx,
      stored: [
        season({
          status: 'completed',
          startedAt: '2026-01-01',
          finishedAt: '2026-01-10',
          watchedCount: 3,
        }),
      ],
      watches: { '101': [undated], '102': [undated], '103': [undated] },
    });
    expect(plan.series[0]?.seasons[0]).toMatchObject({
      status: 'completed',
      startedAt: '2026-01-02',
      finishedAt: '2026-01-05',
    });
  });
});

describe('collapseUndatedViewing', () => {
  it('leaves lists without an undated first viewing alone', () => {
    expect(collapseUndatedViewing([view('2026-01-01'), view('2026-02-01')], null)).toEqual([
      view('2026-01-01'),
      view('2026-02-01'),
    ]);
    expect(collapseUndatedViewing([undated], null)).toEqual([undated]);
  });

  it('does not treat an open viewing as dated', () => {
    const open: Viewing = { startedAt: '2026-01-01', finishedAt: null };
    expect(collapseUndatedViewing([undated, open], null)).toEqual([undated, open]);
  });
});

describe('mergeEpisodeWatches with season finishes', () => {
  it('leaves episodes outside the known seasons alone', () => {
    const stored: EpisodeWatches = { a: [undated, view('2026-01-01')] };
    expect(mergeEpisodeWatches(stored, {})).toEqual(stored);
  });
});

describe('reopenCompletedSeason', () => {
  const completed = {
    status: 'completed' as const,
    startedAt: '2026-01-01',
    finishedAt: '2026-02-01',
    rewatches: [],
    wantsRewatch: false,
  };
  const episodes = [
    { key: '1', airDate: '2026-01-01' },
    { key: '2', airDate: '2026-01-08' },
  ];
  const watched: EpisodeWatches = { '1': [view('2026-01-02')], '2': [view('2026-01-09')] };
  const none = new Set<string>();

  it('goes back to in progress, unfinished, when an aired episode is not watched', () => {
    const next = [...episodes, { key: '3', airDate: '2026-03-01' }];
    expect(reopenCompletedSeason(completed, next, watched, none, TODAY)).toEqual({
      status: 'in_progress',
      startedAt: '2026-01-01',
      finishedAt: null,
      rewatches: [],
      wantsRewatch: false,
    });
  });

  it('stays when the new episode is watched, skipped, unaired or undated', () => {
    const base = { ...watched };
    const aired = [...episodes, { key: '3', airDate: '2026-03-01' }];
    expect(reopenCompletedSeason(completed, aired, { ...base, '3': [] }, none, TODAY)).toBeNull();
    expect(reopenCompletedSeason(completed, aired, base, new Set(['3']), TODAY)).toBeNull();
    const future = [...episodes, { key: '3', airDate: '2999-01-01' }];
    expect(reopenCompletedSeason(completed, future, base, none, TODAY)).toBeNull();
    const undatedEpisode = [...episodes, { key: '3', airDate: null }];
    expect(reopenCompletedSeason(completed, undatedEpisode, base, none, TODAY)).toBeNull();
  });

  it('leaves seasons whose status is not derived from episodes or that are being watched again', () => {
    const next = [...episodes, { key: '3', airDate: '2026-03-01' }];
    expect(reopenCompletedSeason(completed, next, {}, none, TODAY)).toBeNull();
    expect(
      reopenCompletedSeason({ ...completed, status: 'in_progress' }, next, watched, none, TODAY),
    ).toBeNull();
    const rewatching = { ...completed, rewatches: [{ startedAt: '2026-04-01', finishedAt: null }] };
    expect(reopenCompletedSeason(rewatching, next, watched, none, TODAY)).toBeNull();
  });
});

describe('hasCollapsibleViewings', () => {
  it('is true when an undated first viewing is followed by one the season finish allows', () => {
    const watches: EpisodeWatches = { a: [undated, view('2026-01-05')] };
    expect(hasCollapsibleViewings(watches, ['2026-01-10'])).toBe(true);
    expect(hasCollapsibleViewings(watches, [null])).toBe(true);
    expect(hasCollapsibleViewings(watches, [])).toBe(true);
    expect(hasCollapsibleViewings(watches, ['2026-01-01'])).toBe(false);
    expect(hasCollapsibleViewings({ a: [undated] }, [null])).toBe(false);
  });
});
