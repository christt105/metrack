import { describe, expect, it } from 'vitest';
import type {
  ConnectorSyncState,
  EpisodeWatches,
  SeasonChange,
  SeriesChange,
  UnmatchedEpisode,
} from '@metrack/domain';
import { emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import { connectorHarness } from './support/connectorHarness.js';

const view = (finishedAt: string, startedAt: string | null = null) => ({ startedAt, finishedAt });

async function setup() {
  const harness = await connectorHarness();
  const { secret } = await harness.createToken(1, 'connector');
  const { season, series } = await harness.scope.run(2, async () => {
    const created = await harness.repositories.series.create({
      ...emptySeries(),
      tmdbId: 77,
      title: 'Show',
    });
    const added = await harness.repositories.seasons.create({
      ...emptySeason(),
      seriesId: created.id,
      number: 1,
      episodeCount: 3,
      jellyfinId: 'js1',
      status: 'in_progress',
      startedAt: '2026-01-01',
    });
    return { season: added, series: created };
  });
  const stateOf = async () =>
    (
      await harness.call('GET', '/api/connector/users/2/sync-state', secret)
    ).json<ConnectorSyncState>();
  const change = (over: Partial<SeasonChange>, watches?: EpisodeWatches): SeriesChange => ({
    seriesId: series.id,
    jellyfinId: 'js',
    year: null,
    tmdbId: 77,
    tvdbId: null,
    title: 'Show',
    seasons: [
      {
        seasonId: season.id,
        matchedBy: 'number',
        jellyfinSeasonId: 'js1',
        number: 1,
        tmdbSeasonNumber: null,
        title: null,
        firstAirDate: null,
        episodeCount: 3,
        status: 'in_progress',
        startedAt: '2026-01-01',
        finishedAt: null,
        watchedEpisodes: 0,
        completes: false,
        missingRating: false,
        ...over,
      },
    ],
    ...(watches ? { watches } : {}),
  });
  const send = async (over: Partial<SeasonChange>, watches?: EpisodeWatches) =>
    harness.call(
      'POST',
      '/api/connector/users/2/sync',
      secret,
      harness.syncBody((await stateOf()).contentVersion, { series: [change(over, watches)] }),
    );
  const sendUnmatched = async (unmatched?: UnmatchedEpisode[]) =>
    harness.call(
      'POST',
      '/api/connector/users/2/sync',
      secret,
      harness.syncBody((await stateOf()).contentVersion, {
        series: [{ ...change({}), seasons: [], ...(unmatched ? { unmatched } : {}) }],
      }),
    );
  return { ...harness, season, series, secret, stateOf, send, sendUnmatched };
}

describe('connector sync of episodes', () => {
  it('serves the stored watches of the series in the state', async () => {
    const { stateOf, repositories, scope, series } = await setup();
    expect((await stateOf()).state.watches).toEqual([]);
    await scope.run(2, () =>
      repositories.episodeWatches.set(series.id, { '1': [view('2026-01-02')] }),
    );
    expect((await stateOf()).state.watches).toEqual([
      {
        seriesId: series.id,
        watched: { '1': [view('2026-01-02')] },
        skipped: [],
        unmatched: [],
      },
    ]);
    expect((await stateOf()).state.seasons[0]).toMatchObject({
      rewatches: [],
      viewings: [],
    });
  });

  it('writes the series watches and the season count the plan carries', async () => {
    const { send, repositories, scope, season, series } = await setup();
    const response = await send(
      { watchedEpisodes: 2 },
      { '1': [view('2026-01-02')], '2': [view('2026-01-03')] },
    );
    expect(response.statusCode).toBe(200);
    await scope.run(2, async () => {
      expect(await repositories.episodeWatches.get(series.id)).toEqual({
        '1': [view('2026-01-02')],
        '2': [view('2026-01-03')],
      });
      expect((await repositories.seasons.get(season.id))?.watchedCount).toBe(2);
      expect((await repositories.episodeWatches.getEntry(series.id))?.lastActivityAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  it('replaces the viewings of the episodes the plan carries and keeps the other episodes', async () => {
    const { send, repositories, scope, series } = await setup();
    await scope.run(2, () =>
      repositories.episodeWatches.set(series.id, {
        '1': [view('2026-01-02')],
        '3': [],
      }),
    );
    await send({}, { '1': [view('2026-01-02'), view('2026-02-02')], '2': [view('2026-02-03')] });
    await scope.run(2, async () => {
      expect(await repositories.episodeWatches.get(series.id)).toEqual({
        '1': [view('2026-01-02'), view('2026-02-02')],
        '2': [view('2026-02-03')],
        '3': [],
      });
    });
  });

  it('writes the rewatches the plan carries, closed ones included', async () => {
    const { send, repositories, scope, season } = await setup();
    await scope.run(2, () =>
      repositories.seasons.update(season.id, {
        status: 'completed',
        finishedAt: '2026-02-01',
        rewatches: [view('2026-03-01', '2026-02-20')],
      }),
    );
    await send(
      {
        status: 'completed',
        finishedAt: '2026-02-01',
        rewatches: [
          view('2026-03-01', '2026-02-20'),
          { startedAt: '2026-06-01', finishedAt: null },
        ],
        wantsRewatch: true,
      },
      { '1': [view('2026-06-01')] },
    );
    await scope.run(2, async () => {
      expect((await repositories.seasons.get(season.id))?.rewatches).toEqual([
        view('2026-03-01', '2026-02-20'),
        { startedAt: '2026-06-01', finishedAt: null },
      ]);
    });
  });

  it('still applies a plan shaped like connector 0.20.0, which sends no watches', async () => {
    const { send, repositories, scope, season, series } = await setup();
    const response = await send({
      status: 'completed',
      finishedAt: '2026-03-01',
      completes: true,
      watchedEpisodes: undefined,
    } as Partial<SeasonChange>);
    expect(response.statusCode).toBe(200);
    await scope.run(2, async () => {
      expect(await repositories.seasons.get(season.id)).toMatchObject({
        status: 'completed',
        finishedAt: '2026-03-01',
        pendingReview: true,
        watchedCount: 3,
      });
      expect(await repositories.episodeWatches.get(series.id)).toBeUndefined();
    });
  });

  it('accepts a state read by a connector that predates episodes', async () => {
    const { call, syncBody, secret, stateOf } = await setup();
    const { contentVersion } = await stateOf();
    const response = await call(
      'POST',
      '/api/connector/users/2/sync',
      secret,
      syncBody(contentVersion, {}),
    );
    expect(response.statusCode).toBe(200);
  });

  it('keeps only the played episodes of a series without a row', async () => {
    const { send, repositories, scope, season, series } = await setup();
    await send({ watchedEpisodes: 1 }, { '2': [view('2026-01-05')] });
    await scope.run(2, async () => {
      expect(await repositories.episodeWatches.get(series.id)).toEqual({
        '2': [view('2026-01-05')],
      });
      expect((await repositories.seasons.get(season.id))?.watchedCount).toBe(1);
    });
  });

  it('keeps the viewing of an episode collapsed by the plan', async () => {
    const { send, repositories, scope, series } = await setup();
    await scope.run(2, () =>
      repositories.episodeWatches.set(series.id, {
        '1': [{ startedAt: null, finishedAt: null }, view('2026-01-02')],
      }),
    );
    await send({}, { '1': [view('2026-01-02')] });
    await scope.run(2, async () => {
      expect(await repositories.episodeWatches.get(series.id)).toEqual({
        '1': [view('2026-01-02')],
      });
    });
  });

  describe('unmatched episodes', () => {
    const lost: UnmatchedEpisode[] = [
      { code: 'episode_unmatched', season: 1, number: 2, name: 'Pilot' },
      { code: 'episode_other_series', season: 1, number: 3, name: null, tmdbSeriesId: 9 },
    ];

    it('stores the list, serves it in the state and replaces it on the next sync', async () => {
      const { sendUnmatched, repositories, scope, series, stateOf } = await setup();
      expect((await sendUnmatched(lost)).statusCode).toBe(200);
      await scope.run(2, async () => {
        expect((await repositories.episodeWatches.getEntry(series.id))?.unmatched).toEqual(lost);
      });
      expect((await stateOf()).state.watches?.[0]?.unmatched).toEqual(lost);
      await sendUnmatched([lost[0]!]);
      await scope.run(2, async () => {
        expect((await repositories.episodeWatches.getEntry(series.id))?.unmatched).toEqual([
          lost[0],
        ]);
      });
    });

    it('is cleared by an empty list', async () => {
      const { sendUnmatched, repositories, scope, series } = await setup();
      await sendUnmatched(lost);
      await sendUnmatched([]);
      await scope.run(2, async () => {
        expect((await repositories.episodeWatches.getEntry(series.id))?.unmatched).toEqual([]);
      });
    });

    it('is left as it is by a plan that carries none, like one from connector 0.21.0', async () => {
      const { sendUnmatched, send, repositories, scope, series } = await setup();
      await sendUnmatched(lost);
      await send({}, { '1': [view('2026-01-02')] });
      await sendUnmatched();
      await scope.run(2, async () => {
        const entry = await repositories.episodeWatches.getEntry(series.id);
        expect(entry?.unmatched).toEqual(lost);
        expect(entry?.watched).toEqual({ '1': [view('2026-01-02')] });
      });
    });

    it('rejects a malformed list', async () => {
      const { sendUnmatched } = await setup();
      const response = await sendUnmatched([{ code: 'nope', season: 1 } as never]);
      expect(response.statusCode).toBe(400);
    });
  });
});
