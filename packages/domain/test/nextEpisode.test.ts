import { describe, expect, it } from 'vitest';
import {
  buildNextEpisodeRow,
  latestViewingDate,
  pickNextSeason,
  type Episode,
  type EpisodeWatches,
  type NextSeasonPick,
  type Season,
  type Viewing,
} from '../src/index.js';

const TODAY = '2026-03-05';

const pickNext = (seasons: Season[]) => pickNextSeason(seasons, TODAY);

const season = (number: number, patch: Partial<Season> = {}): Season => ({
  id: number + 10,
  seriesId: 1,
  number,
  tmdbSeasonNumber: number,
  jellyfinId: null,
  title: null,
  overview: null,
  firstAirDate: null,
  episodeCount: 4,
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
  ...patch,
});

const episode = (number: number, airDate: string | null = '2026-01-01'): Episode => ({
  number,
  title: `Episode ${number}`,
  airDate,
  runtime: 24,
  tmdbId: 100 + number,
  overview: null,
  stillPath: `/still${number}.jpg`,
});

const watched = (...numbers: number[]): EpisodeWatches =>
  Object.fromEntries(
    numbers.map((n): [string, Viewing[]] => [
      String(100 + n),
      [{ startedAt: '2026-01-10', finishedAt: '2026-01-10' }],
    ]),
  );

const series = { id: 1, title: 'Show', cover: '/cover', banner: null };

const row = (
  pick: NextSeasonPick,
  episodes: Episode[] | undefined,
  watches: EpisodeWatches = {},
  skipped: string[] = [],
) =>
  buildNextEpisodeRow({
    series,
    pick,
    catalog: episodes ? { episodes, source: 'tmdb' } : undefined,
    watches,
    skipped,
    filler: { '103': 'filler' },
    today: TODAY,
    lastActivityAt: '2026-03-01T10:00:00.000Z',
  });

const four = [episode(1), episode(2), episode(3), episode(4)];

describe('pickNextSeason', () => {
  it('picks the first season in progress', () => {
    const pick = pickNext([
      season(1, { status: 'completed' }),
      season(2, { status: 'in_progress' }),
      season(3, { status: 'in_progress' }),
    ]);
    expect(pick?.season.number).toBe(2);
    expect(pick).toMatchObject({ rewatch: false, newSeason: false, rewatchStart: null });
  });

  it('picks a completed season the user wants to watch again, counting viewings from today', () => {
    const result = pickNext([
      season(1, { status: 'completed' }),
      season(2, { status: 'completed', wantsRewatch: true }),
    ]);
    expect(result?.season.number).toBe(2);
    expect(result).toMatchObject({ rewatch: true, rewatchStart: TODAY });
  });

  it('starts a wanted rewatch at the date its open rewatch started', () => {
    const result = pickNext([
      season(1, {
        status: 'completed',
        wantsRewatch: true,
        rewatches: [{ startedAt: '2026-02-01', finishedAt: null }],
      }),
    ]);
    expect(result).toMatchObject({ rewatch: true, rewatchStart: '2026-02-01' });
  });

  it('prefers the lowest season with an open rewatch over one in progress', () => {
    const open: Viewing[] = [{ startedAt: '2026-02-01', finishedAt: null }];
    const pick = pickNext([
      season(1, { status: 'completed', rewatches: open }),
      season(2, { status: 'in_progress' }),
      season(3, {
        status: 'completed',
        rewatches: [{ startedAt: '2026-02-05', finishedAt: null }],
      }),
    ]);
    expect(pick).toMatchObject({ rewatch: true, rewatchStart: '2026-02-01' });
    expect(pick?.season.number).toBe(1);
  });

  it('picks the season after the last completed one as a new season', () => {
    const pick = pickNext([
      season(1, { status: 'completed' }),
      season(2, { status: 'completed' }),
      season(3),
    ]);
    expect(pick?.season.number).toBe(3);
    expect(pick?.newSeason).toBe(true);
  });

  it('does not offer the next season after a dropped one', () => {
    expect(
      pickNext([season(1, { status: 'completed' }), season(2, { status: 'dropped' }), season(3)]),
    ).toBeNull();
  });

  it('does not pick a series whose last started season is not completed', () => {
    expect(
      pickNext([season(1, { status: 'completed' }), season(2, { status: 'paused' }), season(3)]),
    ).toBeNull();
  });

  it('returns nothing for paused and dropped series', () => {
    expect(pickNext([season(1, { status: 'paused' })])).toBeNull();
    expect(
      pickNext([season(1, { status: 'dropped' }), season(2, { status: 'paused' })]),
    ).toBeNull();
    expect(pickNext([season(1, { status: 'completed' })])).toBeNull();
  });

  it('never picks season 0 unless it is the only one in progress', () => {
    expect(
      pickNext([season(0, { status: 'in_progress' }), season(1, { status: 'in_progress' })])?.season
        .number,
    ).toBe(1);
    expect(
      pickNext([season(0, { status: 'in_progress' }), season(1, { status: 'completed' })])?.season
        .number,
    ).toBe(0);
    expect(
      pickNext([season(0, { status: 'planned' }), season(1, { status: 'completed' })]),
    ).toBeNull();
    expect(
      pickNext([season(0), season(1, { status: 'completed' }), season(2)])?.season.number,
    ).toBe(2);
  });

  it('moves a whole series rewatch from the first season to the second', () => {
    const done = [{ startedAt: '2026-02-01', finishedAt: '2026-02-10' }];
    const pick = pickNext([
      season(1, { status: 'completed', rewatches: done }),
      season(2, { status: 'completed' }),
    ]);
    expect(pick).toMatchObject({ rewatch: true, rewatchStart: '2026-02-10' });
    expect(pick?.season.number).toBe(2);
  });

  it('stops once the next season has a rewatch after the closed one, or the last season is reached', () => {
    const first = [{ startedAt: '2026-02-01', finishedAt: '2026-02-10' }];
    const second = [{ startedAt: '2026-02-11', finishedAt: '2026-02-20' }];
    expect(
      pickNext([
        season(1, { status: 'completed', rewatches: first }),
        season(2, { status: 'completed', rewatches: second }),
      ]),
    ).toBeNull();
    expect(
      pickNext([
        season(1, { status: 'completed', rewatches: first }),
        season(2, { status: 'completed', rewatches: second }),
        season(3, { status: 'completed' }),
      ])?.season.number,
    ).toBe(3);
  });
});

const inProgress: NextSeasonPick = {
  season: season(2, { status: 'in_progress', watchedCount: 2 }),
  rewatchStart: null,
  rewatch: false,
  newSeason: false,
};

describe('buildNextEpisodeRow', () => {
  it('points at the first aired episode not watched yet, with the filler and progress', () => {
    const result = row(inProgress, four, watched(1, 2));
    expect(result).toMatchObject({
      series: { id: 1, title: 'Show', cover: '/cover' },
      season: { id: 12, number: 2, episodeCount: 4 },
      episode: {
        number: 3,
        key: '103',
        title: 'Episode 3',
        stillPath: '/still3.jpg',
        filler: 'filler',
      },
      source: 'tmdb',
      availability: 'ready',
      airsOn: null,
      labels: [],
      progress: { watched: 2, total: 4, skipped: 0, rewatch: false },
      lastActivityAt: '2026-03-01T10:00:00.000Z',
    });
  });

  it('steps over skipped episodes in the middle and counts them as progress', () => {
    const picked = {
      ...inProgress,
      season: season(2, { status: 'in_progress', watchedCount: 1, skippedCount: 1 }),
    };
    const result = row(picked, four, watched(1), ['102']);
    expect(result?.episode.number).toBe(3);
    expect(result?.progress).toEqual({ watched: 2, total: 4, skipped: 1, rewatch: false });
  });

  it('says when the next episode has not aired yet', () => {
    const result = row(
      inProgress,
      [episode(1), episode(2), episode(3, '2026-03-20')],
      watched(1, 2),
    );
    expect(result).toMatchObject({
      episode: { number: 3 },
      availability: 'airs',
      airsOn: '2026-03-20',
    });
  });

  it('is absent when everything is watched and up to date', () => {
    expect(row(inProgress, four, watched(1, 2, 3, 4))).toBeNull();
    expect(row(inProgress, four, watched(1, 2, 3), ['104'])).toBeNull();
  });

  it('labels a rewatch and counts only the viewings since its start', () => {
    const pick: NextSeasonPick = {
      season: season(1, {
        status: 'completed',
        watchedCount: 4,
        rewatches: [{ startedAt: '2026-03-01', finishedAt: null }],
      }),
      rewatchStart: '2026-03-01',
      rewatch: true,
      newSeason: false,
    };
    const watches: EpisodeWatches = {
      '101': [
        { startedAt: '2026-01-10', finishedAt: '2026-01-10' },
        { startedAt: '2026-03-02', finishedAt: '2026-03-02' },
      ],
      '102': [{ startedAt: '2026-01-11', finishedAt: '2026-01-11' }],
    };
    const result = row(pick, four, watches);
    expect(result?.labels).toEqual(['rewatch']);
    expect(result?.episode.number).toBe(2);
    expect(result?.progress).toEqual({ watched: 1, total: 4, skipped: 0, rewatch: true });
  });

  it('labels the first episode of a new season, aired', () => {
    const pick: NextSeasonPick = {
      season: season(3),
      rewatchStart: null,
      rewatch: false,
      newSeason: true,
    };
    const result = row(pick, four);
    expect(result).toMatchObject({
      labels: ['newSeason'],
      episode: { number: 1 },
      availability: 'ready',
      progress: { watched: null, total: 4 },
    });
  });

  it('announces a new season whose episodes have not aired', () => {
    const pick: NextSeasonPick = {
      season: season(3),
      rewatchStart: null,
      rewatch: false,
      newSeason: true,
    };
    const result = row(pick, [episode(1, '2026-04-01'), episode(2, '2026-04-08')]);
    expect(result).toMatchObject({
      availability: 'premieres',
      airsOn: '2026-04-01',
      episode: { number: 1 },
    });
  });

  it('answers by number when the season has no catalog', () => {
    const result = row(inProgress, undefined);
    expect(result).toMatchObject({
      source: 'numbers',
      availability: 'ready',
      episode: { number: 3, key: null, title: null, stillPath: null },
      progress: { watched: 2, total: 4 },
    });
    expect(row(inProgress, [])?.source).toBe('numbers');
  });

  it('announces a new season without catalog by its first air date, or its first episode when the date is past', () => {
    const upcoming: NextSeasonPick = {
      season: season(3, { firstAirDate: '2026-06-01' }),
      rewatchStart: null,
      rewatch: false,
      newSeason: true,
    };
    expect(row(upcoming, undefined)).toMatchObject({
      availability: 'premieres',
      airsOn: '2026-06-01',
      episode: { number: 1 },
    });
    const aired: NextSeasonPick = {
      ...upcoming,
      season: season(3, { firstAirDate: '2026-01-01' }),
    };
    expect(row(aired, undefined)).toMatchObject({ availability: 'ready', episode: { number: 1 } });
  });

  it('does not list a season without catalog whose episodes are all watched', () => {
    const done: NextSeasonPick = {
      ...inProgress,
      season: season(2, { status: 'in_progress', watchedCount: 4 }),
    };
    expect(row(done, undefined)).toBeNull();
  });

  it('continues a rewatch of the whole series from the closed season to the next one', () => {
    const pick = pickNext([
      season(1, {
        status: 'completed',
        rewatches: [{ startedAt: '2026-02-01', finishedAt: '2026-02-10' }],
      }),
      season(2, { status: 'completed', watchedCount: 4 }),
    ]);
    expect(pick).not.toBeNull();
    const watches: EpisodeWatches = {
      '101': [{ startedAt: '2026-01-01', finishedAt: '2026-01-01' }],
      '102': [{ startedAt: '2026-01-02', finishedAt: '2026-01-02' }],
      '103': [{ startedAt: '2026-02-12', finishedAt: '2026-02-12' }],
    };
    const result = row(pick as NextSeasonPick, four, watches);
    expect(result).toMatchObject({
      labels: ['rewatch'],
      season: { number: 2 },
      episode: { number: 1 },
    });
  });
});

describe('latestViewingDate', () => {
  it('finds the most recent date and is null without any', () => {
    expect(latestViewingDate({})).toBeNull();
    expect(latestViewingDate({ a: [] })).toBeNull();
    expect(
      latestViewingDate({
        a: [{ startedAt: '2026-01-01', finishedAt: '2026-01-02' }],
        b: [{ startedAt: null, finishedAt: '2026-02-01' }],
      }),
    ).toBe('2026-02-01');
  });
});
