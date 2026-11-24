import { describe, expect, it } from 'vitest';
import {
  planSync,
  type EpisodeWatches,
  type LibrarySeason,
  type Season,
  type Series,
  type SeriesIndex,
  type Viewing,
} from '../src/index.js';

const TODAY = '2026-11-17';

const view = (day: string): Viewing => ({ startedAt: day, finishedAt: day });
const plain = (finishedAt: string): Viewing => ({ startedAt: null, finishedAt });

function librarySeason(
  count: number,
  over: {
    number?: number;
    numbered?: boolean;
    tvdbBase?: number | null;
    airDate?: string | null;
  } = {},
): LibrarySeason {
  const number = over.number ?? 1;
  return {
    jellyfinId: `js${number}`,
    number,
    title: null,
    episodes: Array.from({ length: count }, (_, i) => ({
      jellyfinId: `s${number}e${i + 1}`,
      number: over.numbered === false ? null : i + 1,
      airDate: over.airDate === undefined ? '2025-01-01' : over.airDate,
      runtimeSeconds: 1500,
      available: true,
      tvdbId: over.tvdbBase === undefined || over.tvdbBase === null ? null : over.tvdbBase + i,
    })),
  };
}

function storedSeries(over: Partial<Series> = {}): Series {
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

interface Run {
  seasons: LibrarySeason[];
  days: Record<string, string[]>;
  stored?: Season[];
  watches?: EpisodeWatches;
  skipped?: string[];
  series?: Series | null;
  index?: SeriesIndex;
}

function run(input: Run) {
  const existing = input.series === null ? [] : [input.series ?? storedSeries()];
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
      series: existing,
      seasons: input.stored ?? [],
      unlinked: [],
      ...(input.watches
        ? { watches: [{ seriesId: 1, watched: input.watches, skipped: input.skipped ?? [] }] }
        : {}),
    },
    ...(input.index ? { indexes: new Map([['js', input.index]]) } : {}),
    today: TODAY,
    timeZone: 'UTC',
  });
}

const one = (input: Run) => {
  const plan = run(input);
  return { change: plan.series[0]?.seasons[0], series: plan.series[0], warnings: plan.warnings };
};

describe('numbered sync (no TMDB index)', () => {
  it('records one viewing per watched day under the fallback key, starting and ending that day', () => {
    const { change, series } = one({
      seasons: [librarySeason(3)],
      stored: [stored()],
      days: { s1e2: ['2026-03-01', '2026-04-01'] },
    });
    expect(series?.watches).toEqual({ s1e2: [view('2026-03-01'), view('2026-04-01')] });
    expect(change).toMatchObject({
      status: 'in_progress',
      startedAt: '2026-03-01',
      watchedEpisodes: 1,
    });
  });

  it('merges with the stored watches and never removes a hand-marked viewing', () => {
    const { series } = one({
      seasons: [librarySeason(3)],
      stored: [stored({ status: 'in_progress', startedAt: '2026-01-01', watchedCount: 2 })],
      days: { s1e2: ['2026-03-01'] },
      watches: { s1e1: [plain('2026-01-01')], s1e2: [plain('2026-02-02')] },
    });
    expect(series?.watches).toEqual({
      s1e1: [plain('2026-01-01')],
      s1e2: [plain('2026-02-02'), view('2026-03-01')],
    });
  });

  it('completes from stored and incoming watches together and flags the missing rating', () => {
    const { change } = one({
      seasons: [librarySeason(3)],
      stored: [stored({ status: 'in_progress', startedAt: '2026-01-01', watchedCount: 2 })],
      days: { s1e3: ['2026-03-03'] },
      watches: { s1e1: [plain('2026-01-01')], s1e2: [plain('2026-01-02')] },
    });
    expect(change).toMatchObject({
      status: 'completed',
      startedAt: '2026-01-01',
      finishedAt: '2026-03-03',
      completes: true,
      missingRating: true,
      watchedEpisodes: 3,
    });
  });

  it('unskips an episode that was played and keeps the other skip', () => {
    const { change, series } = one({
      seasons: [librarySeason(3)],
      stored: [
        stored({
          status: 'in_progress',
          startedAt: '2026-01-01',
          watchedCount: 1,
          skippedCount: 2,
        }),
      ],
      days: { s1e2: ['2026-03-01'] },
      watches: { s1e1: [plain('2026-01-01')] },
      skipped: ['s1e2', 's1e3'],
    });
    expect(series?.skipped).toEqual(['s1e3']);
    expect(change).toMatchObject({ status: 'completed', watchedEpisodes: 2, skippedEpisodes: 1 });
  });

  it('completes a season whose unplayed episodes are skipped', () => {
    const { change, series } = one({
      seasons: [librarySeason(3)],
      stored: [
        stored({
          status: 'in_progress',
          startedAt: '2026-01-01',
          watchedCount: 1,
          skippedCount: 1,
        }),
      ],
      days: { s1e3: ['2026-03-03'] },
      watches: { s1e1: [plain('2026-01-01')] },
      skipped: ['s1e2'],
    });
    expect(series?.skipped).toBeUndefined();
    expect(change).toMatchObject({
      status: 'completed',
      finishedAt: '2026-03-03',
      skippedEpisodes: 1,
    });
  });

  it('emits nothing when the merged watches equal the stored ones', () => {
    const plan = run({
      seasons: [librarySeason(3)],
      stored: [stored({ status: 'in_progress', startedAt: '2026-03-01', watchedCount: 1 })],
      days: { s1e1: ['2026-03-01'] },
      watches: { s1e1: [view('2026-03-01')] },
    });
    expect(plan.series).toEqual([]);
  });

  it('treats a completed season without watches as all watched on an unknown date and keeps its rewatches closed', () => {
    const { change, series } = one({
      seasons: [librarySeason(3)],
      stored: [
        stored({
          status: 'completed',
          startedAt: '2026-01-01',
          finishedAt: '2026-02-01',
          watchedCount: 3,
        }),
      ],
      days: { s1e1: ['2026-01-05'] },
    });
    expect(series?.watches).toEqual({ s1e1: [view('2026-01-05')], s1e2: [], s1e3: [] });
    expect(change?.manualTracking).toMatchObject({ status: 'completed', finishedAt: '2026-02-01' });
    expect(change?.rewatches).toBeUndefined();
  });

  it('opens a rewatch when a completed season the user wants to watch again has a new play after its finish', () => {
    const { change } = one({
      seasons: [librarySeason(3)],
      stored: [
        stored({
          status: 'completed',
          startedAt: '2026-01-01',
          finishedAt: '2026-02-01',
          watchedCount: 3,
          wantsRewatch: true,
        }),
      ],
      days: { s1e1: ['2026-06-01'] },
      watches: { s1e1: [], s1e2: [], s1e3: [] },
    });
    expect(change?.rewatches).toEqual([{ startedAt: '2026-06-01', finishedAt: null }]);
    expect(change?.completes).toBe(false);
  });

  it('does not open a rewatch from a new play when the user did not ask to watch the season again', () => {
    const { change, series } = one({
      seasons: [librarySeason(3)],
      stored: [
        stored({
          status: 'completed',
          startedAt: '2026-01-01',
          finishedAt: '2026-02-01',
          watchedCount: 3,
        }),
      ],
      days: { s1e1: ['2026-06-01'] },
      watches: { s1e1: [], s1e2: [], s1e3: [] },
    });
    expect(change).toBeUndefined();
    expect(series?.watches?.s1e1).toEqual([
      { startedAt: null, finishedAt: null },
      { startedAt: '2026-06-01', finishedAt: '2026-06-01' },
    ]);
  });

  it('opens a rewatch without the intention when the plays start the season over, and not for one loose episode', () => {
    const completed = stored({
      status: 'completed',
      startedAt: '2026-01-01',
      finishedAt: '2026-02-01',
      watchedCount: 3,
    });
    const watches = { s1e1: [], s1e2: [], s1e3: [] };
    const loose = one({
      seasons: [librarySeason(3)],
      stored: [completed],
      days: { s1e3: ['2026-06-03'] },
      watches,
    });
    expect(loose.change).toBeUndefined();
    const started = one({
      seasons: [librarySeason(3)],
      stored: [completed],
      days: { s1e1: ['2026-06-01'], s1e2: ['2026-06-02'] },
      watches,
    });
    expect(started.change?.rewatches).toEqual([{ startedAt: '2026-06-01', finishedAt: null }]);
    expect(started.change?.wantsRewatch).toBeUndefined();
  });

  it('does not add a play that already exists as an abandoned viewing and counts a later one in the new pass', () => {
    const abandoned = (day: string): Viewing => ({
      startedAt: day,
      finishedAt: day,
      abandonedAt: '2026-06-10',
    });
    const watches = { s1e1: [abandoned('2026-06-01')], s1e2: [abandoned('2026-06-02')] };
    const season = stored({ status: 'in_progress', watchedCount: 0 });
    const replay = one({
      seasons: [librarySeason(3)],
      stored: [season],
      days: { s1e1: ['2026-06-01'], s1e2: ['2026-06-02'] },
      watches,
    });
    expect(replay.series?.watches).toBeUndefined();
    expect(replay.change?.watchedEpisodes ?? 0).toBe(0);
    const later = one({
      seasons: [librarySeason(3)],
      stored: [season],
      days: { s1e1: ['2026-06-12'] },
      watches,
    });
    expect(later.series?.watches?.s1e1).toEqual([abandoned('2026-06-01'), view('2026-06-12')]);
    expect(later.change).toMatchObject({ status: 'in_progress', watchedEpisodes: 1 });
  });

  it('closes a rewatch when every episode is played again', () => {
    const { change } = one({
      seasons: [librarySeason(3)],
      stored: [
        stored({
          status: 'completed',
          startedAt: '2026-01-01',
          finishedAt: '2026-02-01',
          watchedCount: 3,
        }),
      ],
      days: { s1e1: ['2026-06-01'], s1e2: ['2026-06-02'], s1e3: ['2026-06-05'] },
      watches: { s1e1: [], s1e2: [], s1e3: [] },
    });
    expect(change?.rewatches).toEqual([{ startedAt: '2026-06-01', finishedAt: '2026-06-05' }]);
  });

  it('does not open a rewatch from a viewing that is already stored, only from a new one', () => {
    const season = stored({
      status: 'completed',
      startedAt: '2026-06-01',
      finishedAt: '2026-06-01',
      watchedCount: 3,
      wantsRewatch: true,
    });
    const watches = { s1e1: [view('2026-06-01')], s1e2: [], s1e3: [] };
    expect(
      run({
        seasons: [librarySeason(3)],
        stored: [season],
        days: { s1e1: ['2026-06-01'] },
        watches,
      }).series,
    ).toEqual([]);
    const { change } = one({
      seasons: [librarySeason(3)],
      stored: [season],
      days: { s1e1: ['2026-06-01'], s1e2: ['2026-07-01'] },
      watches,
    });
    expect(change?.rewatches).toEqual([{ startedAt: '2026-07-01', finishedAt: null }]);
  });

  it('counts the plays after the finish of a completed season without watches as a complete second pass', () => {
    const { change, series } = one({
      seasons: [librarySeason(3)],
      stored: [
        stored({
          status: 'completed',
          startedAt: '2026-01-01',
          finishedAt: '2026-02-01',
          watchedCount: 3,
        }),
      ],
      days: { s1e1: ['2026-06-01'], s1e2: ['2026-06-02'], s1e3: ['2026-06-03'] },
    });
    expect(change?.rewatches).toEqual([{ startedAt: '2026-06-01', finishedAt: '2026-06-03' }]);
    expect(change?.status).toBe('completed');
    expect(change?.startedAt).toBe('2026-01-01');
    expect(change?.finishedAt).toBe('2026-02-01');
    expect(Object.keys(series?.watches ?? {})).toHaveLength(3);
  });

  it('materializes a completed season without watches before adding partial plays and keeps its hand-set dates', () => {
    const { change, series } = one({
      seasons: [librarySeason(12)],
      stored: [stored({ status: 'completed', episodeCount: 12, watchedCount: 12 })],
      days: { s1e1: ['2026-01-05'], s1e2: ['2026-01-06'] },
    });
    expect(Object.keys(series?.watches ?? {})).toHaveLength(12);
    expect(series?.watches?.s1e1).toEqual([view('2026-01-05')]);
    expect(series?.watches?.s1e9).toEqual([]);
    expect(change?.manualTracking).toMatchObject({ status: 'completed' });
    expect(change?.rewatches).toBeUndefined();
  });

  it('records only the played episodes of an in-progress season without watches', () => {
    const { series } = one({
      seasons: [librarySeason(12)],
      stored: [stored({ status: 'in_progress', startedAt: '2026-01-01', episodeCount: 12 })],
      days: { s1e1: ['2026-01-05'], s1e2: ['2026-01-06'] },
    });
    expect(Object.keys(series?.watches ?? {})).toEqual(['s1e1', 's1e2']);
  });

  it('creates a season with its watches', () => {
    const { change, series } = one({
      seasons: [librarySeason(3)],
      series: null,
      days: { s1e1: ['2026-03-01'] },
    });
    expect(change).toMatchObject({ seasonId: null, watchedEpisodes: 1 });
    expect(series?.watches).toEqual({ s1e1: [view('2026-03-01')] });
  });

  it('warns about watched episodes without a number and records nothing', () => {
    const { warnings, series } = one({
      seasons: [librarySeason(3, { numbered: false })],
      series: null,
      days: { s1e1: ['2026-03-01'] },
    });
    expect(warnings).toEqual([expect.objectContaining({ code: 'episode_without_number' })]);
    expect(series?.watches).toBeUndefined();
  });
});

const TVDB = 7000;

function jujutsuIndex(grouped: boolean): SeriesIndex {
  const episodes = grouped
    ? [
        ...Array.from({ length: 3 }, (_, i) => ({
          tmdbId: 100 + i,
          seasonNumber: 1,
          number: i + 1,
          airDate: `2020-10-0${i + 1}`,
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          tmdbId: 200 + i,
          seasonNumber: 2,
          number: i + 1,
          airDate: `2023-07-0${i + 1}`,
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          tmdbId: 300 + i,
          seasonNumber: 3,
          number: i + 1,
          airDate: `2026-01-0${i + 1}`,
        })),
      ]
    : [
        ...Array.from({ length: 3 }, (_, i) => ({
          tmdbId: 100 + i,
          seasonNumber: 1,
          number: i + 1,
          airDate: `2020-10-0${i + 1}`,
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          tmdbId: 200 + i,
          seasonNumber: 1,
          number: i + 4,
          airDate: `2023-07-0${i + 1}`,
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          tmdbId: 300 + i,
          seasonNumber: 1,
          number: i + 6,
          airDate: `2026-01-0${i + 1}`,
        })),
      ];
  const seasons = grouped
    ? [
        { number: 1, title: 'Season 1', firstAirDate: '2020-10-01' },
        { number: 2, title: 'Season 2', firstAirDate: '2023-07-01' },
        { number: 3, title: 'Season 3', firstAirDate: '2026-01-01' },
      ]
    : [{ number: 1, title: 'Jujutsu Kaisen', firstAirDate: '2020-10-01' }];
  const episodeIds: Record<string, number> = {};
  [100, 101, 102, 200, 201, 300, 301].forEach((tmdb, i) => {
    episodeIds[String(TVDB + i)] = tmdb;
  });
  return {
    tmdbId: 95479,
    name: 'Jujutsu Kaisen',
    foreignEpisodes: {},
    episodeIds,
    seasons,
    episodes,
  };
}

function jujutsuLibrary(): LibrarySeason[] {
  const dates = ['2020-10-0', '2023-07-0', '2026-01-0'];
  return [3, 2, 2].map((count, s) => ({
    ...librarySeason(count, {
      number: s + 1,
      tvdbBase: TVDB + [0, 3, 5][s]!,
    }),
    episodes: Array.from({ length: count }, (_, i) => ({
      jellyfinId: `s${s + 1}e${i + 1}`,
      number: i + 1,
      airDate: `${dates[s]}${i + 1}`,
      runtimeSeconds: 1500,
      available: true,
      tvdbId: TVDB + [0, 3, 5][s]! + i,
    })),
  }));
}

describe('sync by TMDB episode id', () => {
  it('records Jellyfin seasons 1 to 3 in the single regular TMDB season', () => {
    const plan = run({
      seasons: jujutsuLibrary(),
      stored: [stored({ tmdbSeasonNumber: 1, episodeCount: 7, firstAirDate: '2020-10-01' })],
      days: { s1e1: ['2026-03-01'], s2e2: ['2026-03-02'], s3e1: ['2026-03-03'] },
      index: jujutsuIndex(false),
    });
    expect(plan.series[0]?.watches).toEqual({
      '100': [view('2026-03-01')],
      '201': [view('2026-03-02')],
      '300': [view('2026-03-03')],
    });
    expect(plan.series[0]?.seasons).toHaveLength(1);
    expect(plan.series[0]?.seasons[0]).toMatchObject({
      seasonId: 5,
      number: 1,
      watchedEpisodes: 3,
      status: 'in_progress',
      startedAt: '2026-03-01',
    });
    expect(plan.warnings).toEqual([]);
  });

  it('records them in the seasons of the episode group and creates the missing ones', () => {
    const plan = run({
      seasons: jujutsuLibrary(),
      stored: [stored({ tmdbSeasonNumber: 1, episodeCount: 3 })],
      series: storedSeries({ tmdbEpisodeGroup: 'group' }),
      days: {
        s1e1: ['2026-03-01'],
        s1e2: ['2026-03-01'],
        s1e3: ['2026-03-01'],
        s2e1: ['2026-03-02'],
        s3e2: ['2026-03-03'],
      },
      index: jujutsuIndex(true),
    });
    const seasons = plan.series[0]?.seasons ?? [];
    expect(seasons.map((s) => [s.seasonId, s.number, s.tmdbSeasonNumber, s.status])).toEqual([
      [5, 1, 1, 'completed'],
      [null, 2, 2, 'in_progress'],
      [null, 3, 3, 'in_progress'],
    ]);
    expect(seasons[1]).toMatchObject({ title: 'Season 2', episodeCount: 2, watchedEpisodes: 1 });
    expect(plan.series[0]?.watches).toMatchObject({
      '102': [view('2026-03-01')],
      '200': [view('2026-03-02')],
      '301': [view('2026-03-03')],
    });
  });

  it('takes a free number for a created season when the ordering number is used by another season', () => {
    const plan = run({
      seasons: jujutsuLibrary(),
      stored: [stored({ id: 6, number: 2, tmdbSeasonNumber: 9, episodeCount: 4 })],
      series: storedSeries({ tmdbEpisodeGroup: 'group' }),
      days: { s2e1: ['2026-03-02'] },
      index: jujutsuIndex(true),
    });
    expect(plan.series[0]?.seasons[0]).toMatchObject({
      seasonId: null,
      number: 3,
      tmdbSeasonNumber: 2,
    });
  });

  it('matches by a unique air date when the episode has no TheTVDB id or TMDB does not know it', () => {
    const index = jujutsuIndex(true);
    const library = jujutsuLibrary();
    library[0]!.episodes[0]!.tvdbId = null;
    library[0]!.episodes[1]!.tvdbId = 999999;
    const plan = run({
      seasons: library,
      stored: [stored({ tmdbSeasonNumber: 1 })],
      days: { s1e1: ['2026-03-01'], s1e2: ['2026-03-01'] },
      index,
    });
    expect(Object.keys(plan.series[0]?.watches ?? {}).sort()).toEqual(['100', '101']);
    expect(plan.warnings).toEqual([]);
  });

  it('warns and skips an episode whose air date is shared by several TMDB episodes', () => {
    const index = jujutsuIndex(true);
    index.episodes = index.episodes.map((e) =>
      e.tmdbId === 101 ? { ...e, airDate: '2020-10-01' } : e,
    );
    const library = jujutsuLibrary();
    library[0]!.episodes[0]!.tvdbId = null;
    library[0]!.episodes.pop();
    const plan = run({
      seasons: library,
      stored: [stored({ tmdbSeasonNumber: 1 })],
      days: { s1e1: ['2026-03-01'] },
      index,
    });
    expect(plan.warnings).toEqual([expect.objectContaining({ code: 'episode_unmatched' })]);
    expect(plan.series).toEqual([
      expect.objectContaining({
        seasons: [],
        unmatched: [expect.objectContaining({ code: 'episode_unmatched', season: 1, number: 1 })],
      }),
    ]);
  });

  it('warns when TMDB knows the episode but the ordering lacks it', () => {
    const base = jujutsuIndex(true);
    const index = { ...base, episodeIds: { ...base.episodeIds, [String(TVDB)]: 555 } };
    const library = jujutsuLibrary();
    library[0]!.episodes.pop();
    const plan = run({
      seasons: library,
      stored: [stored({ tmdbSeasonNumber: 1 })],
      days: { s1e1: ['2026-03-01'] },
      index,
    });
    expect(plan.warnings).toEqual([expect.objectContaining({ code: 'episode_unmatched' })]);
  });

  it('never records an episode TMDB places in another series, not even by air date', () => {
    const base = jujutsuIndex(true);
    const episodeIds = { ...base.episodeIds };
    delete episodeIds[String(TVDB)];
    const index = {
      ...base,
      episodeIds,
      foreignEpisodes: { [String(TVDB)]: { showId: 113988, showName: 'Monster: Dahmer' } },
    };
    const library = jujutsuLibrary();
    library[0]!.episodes[0]!.airDate = base.episodes[0]!.airDate;
    const plan = run({
      seasons: library,
      stored: [stored({ tmdbSeasonNumber: 1 })],
      days: { s1e1: ['2026-03-01'] },
      index,
    });
    expect(plan.series).toEqual([
      expect.objectContaining({
        seasons: [],
        unmatched: [
          expect.objectContaining({ code: 'episode_other_series', tmdbSeriesId: 113988 }),
        ],
      }),
    ]);
    expect(plan.warnings).toEqual([
      expect.objectContaining({
        code: 'episode_other_series',
        message: expect.stringContaining('"Monster: Dahmer" (TMDB 113988)'),
      }),
    ]);
    expect(plan.warnings[0]?.message).toContain('"Jujutsu Kaisen" (TMDB 95479)');
  });

  it('keeps the Jellyfin numbering for a series without an index', () => {
    const { series } = one({
      seasons: jujutsuLibrary(),
      stored: [stored()],
      days: { s2e1: ['2026-03-01'] },
    });
    expect(Object.keys(series?.watches ?? {})).toEqual(['s2e1']);
  });

  it('opens a season rewatch only from viewings new against the stored row', () => {
    const index = jujutsuIndex(true);
    const done = stored({
      tmdbSeasonNumber: 1,
      status: 'completed',
      startedAt: '2026-06-01',
      finishedAt: '2026-06-01',
      watchedCount: 3,
      wantsRewatch: true,
    });
    const watches = { '100': [view('2026-06-01')], '101': [], '102': [] };
    const seasons = jujutsuLibrary();
    expect(
      run({
        seasons,
        stored: [done],
        series: storedSeries({ tmdbEpisodeGroup: 'group' }),
        days: { s1e1: ['2026-06-01'] },
        watches,
        index,
      }).series,
    ).toEqual([]);
    const plan = run({
      seasons,
      stored: [done],
      series: storedSeries({ tmdbEpisodeGroup: 'group' }),
      days: { s1e1: ['2026-06-01'], s1e2: ['2026-07-01'] },
      watches,
      index,
    });
    expect(plan.series[0]?.seasons[0]?.rewatches).toEqual([
      { startedAt: '2026-07-01', finishedAt: null },
    ]);
  });
});
