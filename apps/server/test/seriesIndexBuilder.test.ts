import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LibrarySeries, Series, SyncState } from '@metrack/domain';
import { TmdbClient } from '../src/providers/tmdb/TmdbClient.js';
import { NEGATIVE_RETRY_DAYS, TvdbEpisodeIdCache } from '../src/sync/TvdbEpisodeIdCache.js';
import { SeriesIndexBuilder } from '../src/sync/SeriesIndexBuilder.js';
import { pathFetch } from './support/pathFetch.js';

const API = 'https://api.themoviedb.org/3';
const TMDB_ID = 95479;
const GROUP = '6961c83d72e76980b8bd3780';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'metrack-index-'));
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const tmdbEpisode = (id: number, number: number, airDate: string) => ({
  id,
  episode_number: number,
  name: `E${number}`,
  air_date: airDate,
});

function routes(): Record<string, object> {
  return {
    [`${API}/find/11516722`]: {
      tv_results: [],
      tv_episode_results: [{ id: 6701926, show_id: TMDB_ID }],
    },
    [`${API}/find/42`]: { tv_results: [], tv_episode_results: [] },
    [`${API}/tv/${TMDB_ID}`]: {
      id: TMDB_ID,
      seasons: [
        { season_number: 0, name: 'Specials', episode_count: 1 },
        { season_number: 1, name: 'Season 1', air_date: '2020-10-03', episode_count: 2 },
      ],
      'season/1': {
        episodes: [tmdbEpisode(6701925, 1, '2020-10-03'), tmdbEpisode(6701926, 2, '2020-10-10')],
      },
    },
    [`${API}/tv/episode_group/${GROUP}`]: {
      id: GROUP,
      name: 'Seasons',
      type: 6,
      groups: [
        {
          id: 'g1',
          name: 'Season 1',
          order: 1,
          episodes: [{ ...tmdbEpisode(6701925, 1, '2020-10-03'), season_number: 1, order: 0 }],
        },
        {
          id: 'g2',
          name: 'Culling Game',
          order: 2,
          episodes: [{ ...tmdbEpisode(6701926, 2, '2020-10-10'), season_number: 1, order: 0 }],
        },
      ],
    },
  };
}

function library(tvdbIds: (number | null)[]): LibrarySeries {
  return {
    jellyfinId: 'js',
    title: 'Jujutsu Kaisen',
    year: 2020,
    tmdbId: TMDB_ID,
    tvdbId: null,
    seasons: [
      {
        jellyfinId: 'sn3',
        number: 3,
        title: null,
        episodes: tvdbIds.map((tvdbId, i) => ({
          jellyfinId: `e${i + 1}`,
          number: i + 1,
          airDate: null,
          runtimeSeconds: 1500,
          available: true,
          tvdbId,
        })),
      },
    ],
  };
}

const state = (group: string | null = null): SyncState => ({
  movies: [],
  seasons: [],
  overrides: [],
  unlinked: [],
  series: [
    {
      id: 1,
      tmdbId: TMDB_ID,
      tvdbId: null,
      tmdbEpisodeGroup: group,
      jellyfinId: 'js',
      title: 'Jujutsu Kaisen',
    } as Series,
  ],
});

function input(
  series: LibrarySeries,
  watched: string[],
  group: string | null = null,
  today = '2026-11-18',
) {
  return {
    movies: [],
    series: [series],
    plays: watched.map((itemId) => ({
      itemId,
      playedAt: `${today}T12:00:00Z`,
      watchedSeconds: 1500,
      title: 'Show',
    })),
    state: state(group),
    today,
    timeZone: 'UTC',
  };
}

function builder(net: ReturnType<typeof pathFetch>, file = join(dir, 'ids.json')) {
  const cache = new TvdbEpisodeIdCache(file);
  return new SeriesIndexBuilder(
    new TmdbClient(net.fetch, { apiKey: 'key', language: 'en-US' }),
    cache,
  );
}

const finds = (net: ReturnType<typeof pathFetch>) => net.calls.filter((c) => c.includes('/find/'));

describe('SeriesIndexBuilder', () => {
  it('maps a TheTVDB episode id to its TMDB id and reads the regular seasons as the ordering', async () => {
    const net = pathFetch(routes());
    const { indexes } = await builder(net).build(input(library([11516722]), ['e1']));
    expect(indexes.get('js')).toEqual({
      tmdbId: TMDB_ID,
      name: 'Jujutsu Kaisen',
      foreignEpisodes: {},
      episodeIds: { '11516722': 6701926 },
      seasons: [{ number: 1, title: 'Season 1', firstAirDate: '2020-10-03' }],
      episodes: [
        { tmdbId: 6701925, seasonNumber: 1, number: 1, airDate: '2020-10-03' },
        { tmdbId: 6701926, seasonNumber: 1, number: 2, airDate: '2020-10-10' },
      ],
    });
    expect(net.calls.some((c) => c.includes('append_to_response=season%2F1'))).toBe(true);
  });

  it('reads the episode group of the stored series as the ordering', async () => {
    const net = pathFetch(routes());
    const { indexes } = await builder(net).build(input(library([11516722]), ['e1'], GROUP));
    expect(indexes.get('js')?.seasons.map((s) => s.number)).toEqual([1, 2]);
    expect(indexes.get('js')?.episodes).toEqual([
      { tmdbId: 6701925, seasonNumber: 1, number: 1, airDate: '2020-10-03' },
      { tmdbId: 6701926, seasonNumber: 2, number: 1, airDate: '2020-10-10' },
    ]);
  });

  it('asks /find once and remembers the answer in a file', async () => {
    const first = pathFetch(routes());
    await builder(first).build(input(library([11516722]), ['e1']));
    expect(finds(first)).toHaveLength(1);
    expect(JSON.parse(readFileSync(join(dir, 'ids.json'), 'utf8'))['11516722']).toMatchObject({
      tmdb: 6701926,
      show: TMDB_ID,
    });
    const second = pathFetch(routes());
    const { indexes } = await builder(second).build(input(library([11516722]), ['e1']));
    expect(finds(second)).toHaveLength(0);
    expect(indexes.get('js')?.episodeIds).toEqual({ '11516722': 6701926 });
  });

  it('asks again for a cached match stored without its series', async () => {
    writeFileSync(
      join(dir, 'ids.json'),
      JSON.stringify({ '11516722': { tmdb: 6701926, at: '2026-11-01' } }),
    );
    const net = pathFetch(routes());
    await builder(net).build(input(library([11516722]), ['e1']));
    expect(finds(net)).toHaveLength(1);
  });

  it('keeps an episode of another TMDB series out of the ids and names both shows', async () => {
    const net = pathFetch({
      ...routes(),
      [`${API}/find/7974291`]: { tv_results: [], tv_episode_results: [{ id: 5, show_id: 113988 }] },
      [`${API}/tv/113988`]: { id: 113988, name: 'Monstruo: La historia de Jeffrey Dahmer' },
    });
    const first = builder(net);
    const { indexes } = await first.build(input(library([7974291]), ['e1']));
    expect(indexes.get('js')).toMatchObject({
      episodeIds: {},
      foreignEpisodes: {
        '7974291': { showId: 113988, showName: 'Monstruo: La historia de Jeffrey Dahmer' },
      },
    });

    const again = pathFetch({
      ...routes(),
      [`${API}/tv/113988`]: { id: 113988, name: 'Monstruo: La historia de Jeffrey Dahmer' },
    });
    const cached = await builder(again).build(input(library([7974291]), ['e1']));
    expect(finds(again)).toHaveLength(0);
    expect(Object.keys(cached.indexes.get('js')?.foreignEpisodes ?? {})).toEqual(['7974291']);
  });

  it('does not settle a series whose cached episode belongs to another series', async () => {
    writeFileSync(
      join(dir, 'ids.json'),
      JSON.stringify({ '7974291': { tmdb: 5, show: 113988, at: '2026-11-18' } }),
    );
    const wrong = {
      ...input(library([7974291]), ['e1']),
      state: {
        ...state(),
        watches: [
          {
            seriesId: 1,
            watched: { '5': [{ startedAt: '2026-11-18', finishedAt: '2026-11-18' }] },
          },
        ],
      },
    };
    const net = pathFetch({
      ...routes(),
      [`${API}/tv/113988`]: { id: 113988, name: 'Other' },
    });
    const { settled, indexes } = await builder(net).build(wrong);
    expect(settled.size).toBe(0);
    expect(indexes.has('js')).toBe(true);
  });

  it('remembers a miss and asks again only after the retry period', async () => {
    const first = pathFetch(routes());
    await builder(first).build(input(library([42]), ['e1']));
    expect(finds(first)).toHaveLength(1);

    const soon = pathFetch(routes());
    const { indexes } = await builder(soon).build(input(library([42]), ['e1'], null, '2026-11-20'));
    expect(finds(soon)).toHaveLength(0);
    expect(indexes.get('js')?.episodeIds).toEqual({});

    const later = pathFetch(routes());
    await builder(later).build(
      input(library([42]), ['e1'], null, `2026-11-${18 + NEGATIVE_RETRY_DAYS}`),
    );
    expect(finds(later)).toHaveLength(1);
  });

  it('only looks up watched episodes and skips those without a TheTVDB id', async () => {
    const net = pathFetch(routes());
    await builder(net).build(input(library([11516722, 42, null]), ['e1', 'e3']));
    expect(finds(net).map((c) => new URL(c).pathname)).toEqual(['/3/find/11516722']);
  });

  it('settles a series whose watched episodes are all recorded and does not ask TMDB about it', async () => {
    const first = pathFetch(routes());
    await builder(first).build(input(library([11516722]), ['e1']));
    const recorded = {
      ...input(library([11516722]), ['e1']),
      state: {
        ...state(),
        watches: [
          {
            seriesId: 1,
            watched: { '6701926': [{ startedAt: '2026-11-18', finishedAt: '2026-11-18' }] },
          },
        ],
      },
    };
    const second = pathFetch(routes());
    const { indexes, settled } = await builder(second).build(recorded);
    expect(second.calls).toEqual([]);
    expect(indexes.size).toBe(0);
    expect([...settled]).toEqual(['js']);

    const newDay = pathFetch(routes());
    const again = await builder(newDay).build({
      ...recorded,
      plays: [{ ...recorded.plays[0]!, playedAt: '2026-11-19T12:00:00Z' }],
    });
    expect(again.settled.size).toBe(0);
    expect(again.indexes.has('js')).toBe(true);
  });

  it('does nothing for a series without watched episodes', async () => {
    const net = pathFetch(routes());
    const { indexes } = await builder(net).build(input(library([11516722]), []));
    expect(indexes.size).toBe(0);
    expect(net.calls).toEqual([]);
  });

  it('gives no index when the ordering cannot be read, so the series keeps the library numbering', async () => {
    const net = pathFetch({ [`${API}/find/11516722`]: { tv_results: [], tv_episode_results: [] } });
    const { indexes } = await builder(net).build(input(library([11516722]), ['e1']));
    expect(indexes.size).toBe(0);
  });

  it('does not remember a lookup that failed', async () => {
    const net = pathFetch({
      ...routes(),
      [`${API}/find/11516722`]: undefined as unknown as object,
    });
    const cache = new TvdbEpisodeIdCache(join(dir, 'ids.json'));
    const failing = new SeriesIndexBuilder(
      new TmdbClient(
        (async (url: string | URL | Request) =>
          url.toString().includes('/find/')
            ? new Response('down', { status: 500 })
            : net.fetch(url)) as typeof fetch,
        { apiKey: 'key', language: 'en-US' },
      ),
      cache,
    );
    const { indexes } = await failing.build(input(library([11516722]), ['e1']));
    expect(indexes.get('js')?.episodeIds).toEqual({});
    expect(cache.lookup(11516722, '2026-11-18')).toBeUndefined();
  });
});
