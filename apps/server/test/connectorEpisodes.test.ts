import { describe, expect, it } from 'vitest';
import type {
  ConnectorSyncState,
  EpisodeWatches,
  SeasonChange,
  SeriesChange,
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
  return { ...harness, season, series, secret, stateOf, send };
}

describe('connector sync of episodes', () => {
  it('serves the stored watches of the series in the state', async () => {
    const { stateOf, repositories, scope, series } = await setup();
    expect((await stateOf()).state.watches).toEqual([]);
    await scope.run(2, () =>
      repositories.episodeWatches.set(series.id, { '1': [view('2026-01-02')] }),
    );
    expect((await stateOf()).state.watches).toEqual([
      { seriesId: series.id, watched: { '1': [view('2026-01-02')] }, skipped: [] },
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
    });
  });

  it('merges with the stored watches and never removes a viewing', async () => {
    const { send, repositories, scope, series } = await setup();
    await scope.run(2, () =>
      repositories.episodeWatches.set(series.id, {
        '1': [view('2026-01-02')],
        '3': [],
      }),
    );
    await send({}, { '1': [view('2026-02-02')], '2': [view('2026-02-03')] });
    await scope.run(2, async () => {
      expect(await repositories.episodeWatches.get(series.id)).toEqual({
        '1': [view('2026-01-02'), view('2026-02-02')],
        '2': [view('2026-02-03')],
        '3': [],
      });
    });
  });

  it('writes a rewatch the plan opens and keeps the closed ones', async () => {
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
        rewatches: [{ startedAt: '2026-06-01', finishedAt: null }],
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
});
