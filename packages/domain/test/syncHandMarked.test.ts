import { describe, expect, it } from 'vitest';
import {
  mergeEpisodeWatches,
  planSync,
  type EpisodeWatches,
  type LibraryEpisode,
  type LibraryMovie,
  type PlayRecord,
  type Season,
  type Series,
  type SeriesIndex,
  type SyncPlan,
  type Viewing,
} from '../src/index.js';

const TODAY = '2026-11-17';
const view = (day: string): Viewing => ({ startedAt: day, finishedAt: day });
const undated: Viewing = { startedAt: null, finishedAt: null };

const series: Series = {
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
};

const index: SeriesIndex = {
  tmdbId: 10,
  name: 'Show',
  foreignEpisodes: {},
  episodeIds: {},
  seasons: [{ number: 1, title: null, firstAirDate: null }],
  episodes: [1, 2, 3].map((number) => ({
    tmdbId: 100 + number,
    seasonNumber: 1,
    number,
    airDate: null,
  })),
};

const RUNTIME = 1500;

function episode(number: number, over: Partial<LibraryEpisode> = {}): LibraryEpisode {
  return {
    jellyfinId: `e${number}`,
    number,
    name: `Episode ${number}`,
    airDate: null,
    runtimeSeconds: RUNTIME,
    available: true,
    tvdbId: null,
    tmdbId: 100 + number,
    ...over,
  };
}

function marked(playedAt: string): Partial<LibraryEpisode> {
  return { played: true, playedAt };
}

function companion(itemId: string, playedAt: string, seconds = RUNTIME): PlayRecord {
  return { itemId, playedAt, watchedSeconds: seconds, title: 'Show' };
}

interface Run {
  episodes: LibraryEpisode[];
  plays?: PlayRecord[];
  companionPlays?: PlayRecord[];
  watches?: EpisodeWatches;
  seasons?: Season[];
}

function run(input: Run): SyncPlan {
  return planSync({
    movies: [],
    series: [
      {
        jellyfinId: 'js',
        title: 'Show',
        year: 2025,
        tmdbId: 10,
        tvdbId: null,
        seasons: [{ jellyfinId: 'js1', number: 1, title: null, episodes: input.episodes }],
      },
    ],
    plays: input.plays ?? [],
    ...(input.companionPlays ? { companionPlays: input.companionPlays } : {}),
    state: {
      movies: [],
      series: [series],
      seasons: input.seasons ?? [],
      unlinked: [],
      watches: input.watches ? [{ seriesId: 1, watched: input.watches, skipped: [] }] : [],
    },
    indexes: new Map([['js', index]]),
    today: TODAY,
    timeZone: 'UTC',
  });
}

const MARK = '2026-05-10T20:00:00Z';

function datedBy(playedAt: string, seconds = RUNTIME): Run {
  return {
    episodes: [episode(1, marked(MARK))],
    companionPlays: [companion('e1', playedAt, seconds)],
  };
}

describe('episodes marked as played with no playback of the account', () => {
  it('gets the day of a complete companion playback in the 7 days before the mark', () => {
    const plan = run(datedBy('2026-05-06T21:00:00Z'));
    expect(plan.series[0]?.watches).toEqual({ '101': [view('2026-05-06')] });
    expect(plan.handMarked).toEqual({ dated: 1, undated: 0 });
  });

  it('accepts the day of the mark and exactly 7 days before it', () => {
    expect(run(datedBy('2026-05-10T10:00:00Z')).series[0]?.watches).toEqual({
      '101': [view('2026-05-10')],
    });
    expect(run(datedBy('2026-05-03T10:00:00Z')).series[0]?.watches).toEqual({
      '101': [view('2026-05-03')],
    });
  });

  it('takes the latest qualifying day', () => {
    const plan = run({
      episodes: [episode(1, marked(MARK))],
      companionPlays: [
        companion('e1', '2026-05-05T10:00:00Z'),
        companion('e1', '2026-05-08T10:00:00Z'),
      ],
    });
    expect(plan.series[0]?.watches).toEqual({ '101': [view('2026-05-08')] });
  });

  it('stays undated when the companion played it 8 days before the mark', () => {
    const plan = run(datedBy('2026-05-02T10:00:00Z'));
    expect(plan.series[0]?.watches).toEqual({ '101': [] });
    expect(plan.handMarked).toEqual({ dated: 0, undated: 1 });
  });

  it('stays undated when the companion played it after the mark', () => {
    const plan = run(datedBy('2026-05-11T10:00:00Z'));
    expect(plan.series[0]?.watches).toEqual({ '101': [] });
    expect(plan.handMarked).toEqual({ dated: 0, undated: 1 });
  });

  it('stays undated when the companion played less than 90 %', () => {
    const plan = run(datedBy('2026-05-08T10:00:00Z', RUNTIME * 0.89));
    expect(plan.series[0]?.watches).toEqual({ '101': [] });
  });

  it('adds up a companion playback split across sessions of one day', () => {
    const plan = run({
      episodes: [episode(1, marked(MARK))],
      companionPlays: [
        companion('e1', '2026-05-08T10:00:00Z', 800),
        companion('e1', '2026-05-08T18:00:00Z', 700),
      ],
    });
    expect(plan.series[0]?.watches).toEqual({ '101': [view('2026-05-08')] });
  });

  it('stays undated with no companion playback or no mark date', () => {
    expect(
      run({ episodes: [episode(1, marked(MARK))], companionPlays: [] }).series[0]?.watches,
    ).toEqual({
      '101': [],
    });
    const plan = run({
      episodes: [episode(1, { played: true })],
      companionPlays: [companion('e1', '2026-05-08T10:00:00Z')],
    });
    expect(plan.series[0]?.watches).toEqual({ '101': [] });
  });

  it('is ignored when there is no companion list, as before', () => {
    const plan = run({ episodes: [episode(1, marked(MARK))] });
    expect(plan.series).toEqual([]);
    expect(plan.handMarked).toBeUndefined();
  });

  it('is ignored when the episode is not marked as played', () => {
    const plan = run({
      episodes: [episode(1)],
      companionPlays: [companion('e1', '2026-05-08T10:00:00Z')],
    });
    expect(plan.series).toEqual([]);
    expect(plan.handMarked).toEqual({ dated: 0, undated: 0 });
  });

  it('keeps today behaviour when the account has its own playback', () => {
    const own = [companion('e1', '2026-04-01T10:00:00Z')];
    const base = { episodes: [episode(1, marked(MARK))], plays: own };
    const without = run(base);
    const withCompanion = run({
      ...base,
      companionPlays: [companion('e1', '2026-05-08T10:00:00Z')],
    });
    expect(without.series[0]?.watches).toEqual({ '101': [view('2026-04-01')] });
    expect(withCompanion.series).toEqual(without.series);
    expect(withCompanion.handMarked).toEqual({ dated: 0, undated: 0 });
  });

  it('keeps today behaviour when the own playback is partial', () => {
    const plan = run({
      episodes: [episode(1, marked(MARK))],
      plays: [companion('e1', '2026-04-01T10:00:00Z', 300)],
      companionPlays: [companion('e1', '2026-05-08T10:00:00Z')],
    });
    expect(plan.series[0]?.watches).toEqual({ '101': [view('2026-04-01')] });
  });

  it('records the viewing by the library numbering without an index', () => {
    const plan = planSync({
      movies: [],
      series: [
        {
          jellyfinId: 'js',
          title: 'Show',
          year: 2025,
          tmdbId: 10,
          tvdbId: null,
          seasons: [
            { jellyfinId: 'js1', number: 1, title: null, episodes: [episode(2, marked(MARK))] },
          ],
        },
      ],
      plays: [],
      companionPlays: [companion('e2', '2026-05-09T10:00:00Z')],
      state: { movies: [], series: [series], seasons: [], unlinked: [], watches: [] },
      today: TODAY,
      timeZone: 'UTC',
    });
    expect(plan.series[0]?.watches).toEqual({ s1e2: [view('2026-05-09')] });
  });
});

describe('repeated passes over hand-marked episodes', () => {
  function apply(plan: SyncPlan, stored: EpisodeWatches): EpisodeWatches {
    return mergeEpisodeWatches(stored, plan.series[0]?.watches ?? {});
  }

  it('does nothing on the second pass after a dated viewing', () => {
    const input = datedBy('2026-05-06T21:00:00Z');
    const stored = apply(run(input), {});
    expect(stored).toEqual({ '101': [view('2026-05-06')] });
    const second = run({ ...input, watches: stored });
    expect(second.series[0]?.watches).toBeUndefined();
    expect(apply(second, stored)).toEqual(stored);
  });

  it('does nothing on the second pass after an undated viewing, and adds no rewatch', () => {
    const input = datedBy('2026-05-02T10:00:00Z');
    const first = run(input);
    const stored = apply(first, {});
    expect(stored).toEqual({ '101': [] });
    const second = run({ ...input, watches: stored });
    expect(apply(second, stored)).toEqual(stored);
    const third = run({ ...input, watches: apply(second, stored) });
    expect(apply(third, stored)).toEqual(stored);
  });

  it('never duplicates a viewing the user already has, dated or not', () => {
    const input = datedBy('2026-05-06T21:00:00Z');
    expect(apply(run(input), { '101': [view('2026-05-06')] })).toEqual({
      '101': [view('2026-05-06')],
    });
    expect(apply(run(datedBy('2026-05-02T10:00:00Z')), { '101': [view('2026-01-01')] })).toEqual({
      '101': [view('2026-01-01')],
    });
    expect(apply(run(datedBy('2026-05-02T10:00:00Z')), { '101': [undated] })).toEqual({
      '101': [undated],
    });
  });

  it('never overwrites a stored dated viewing with a companion date', () => {
    const stored = apply(run(datedBy('2026-05-06T21:00:00Z')), { '101': [view('2025-03-01')] });
    expect(stored['101']).toContainEqual(view('2025-03-01'));
  });
});

describe('movies marked as played with no playback of the account', () => {
  function movie(over: Partial<LibraryMovie>): LibraryMovie {
    return {
      jellyfinId: 'm1',
      title: 'Film',
      year: 2020,
      tmdbId: 50,
      runtimeSeconds: 6000,
      played: true,
      playedAt: MARK,
      ...over,
    };
  }

  const plan = (movies: LibraryMovie[], companionPlays: PlayRecord[] | undefined) =>
    planSync({
      movies,
      series: [],
      plays: [],
      ...(companionPlays ? { companionPlays } : {}),
      state: { movies: [], series: [], seasons: [], unlinked: [], watches: [] },
      today: TODAY,
      timeZone: 'UTC',
    });

  it('creates the movie on the day of a complete companion playback', () => {
    const result = plan([movie({})], [companion('m1', '2026-05-08T20:00:00Z', 6000)]);
    expect(result.movies).toHaveLength(1);
    expect(result.movies[0]).toMatchObject({ action: 'create', finishedAt: '2026-05-08' });
  });

  it('leaves the movie alone when no companion qualifies', () => {
    expect(plan([movie({})], [companion('m1', '2026-05-01T20:00:00Z', 6000)]).movies).toEqual([]);
    expect(plan([movie({})], undefined).movies).toEqual([]);
  });
});
