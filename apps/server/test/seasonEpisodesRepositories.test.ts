import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { SeasonEpisodes } from '@metrack/domain';
import { emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import type { SeasonFiller } from '../src/storage/repositories/SeasonFiller.js';
import type { Repositories } from '../src/storage/repositories/Repositories.js';
import { FixedUserScope } from '../src/users/FixedUserScope.js';
import { createBackends } from './support/backends.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import type { StorageHarness } from './support/StorageHarness.js';

const backends = createBackends();

afterAll(async () => {
  for (const backend of backends) await backend.dispose();
});

const catalog = (seasonId: number, title = 'Pilot'): SeasonEpisodes => ({
  seasonId,
  episodes: [
    {
      number: 1,
      title,
      airDate: '2026-01-01',
      runtime: 24,
      tmdbId: 11,
      overview: 'Text',
      stillPath: '/a.jpg',
    },
    {
      number: 2,
      title: null,
      airDate: null,
      runtime: null,
      tmdbId: null,
      overview: null,
      stillPath: null,
    },
  ],
  source: 'tmdb',
  fetchedAt: '2026-03-05T12:00:00.000Z',
  complete: true,
});

describe.each(backends)('$name episode repositories', (backend) => {
  let harness: StorageHarness;
  let owner: Repositories;
  let friend: Repositories;
  let seasonId: number;

  beforeEach(async () => {
    harness = await backend.open();
    owner = harness.repositories(OWNER_SCOPE);
    const friendUser = await owner.users.create({ name: 'Friend', email: null });
    friend = harness.repositories(new FixedUserScope(friendUser.id));
    const series = await owner.series.create({ ...emptySeries(), tmdbId: 1, title: 'S' });
    await friend.series.create({ ...emptySeries(), tmdbId: 1, title: 'S' });
    const season = await owner.seasons.create({
      ...emptySeason(),
      seriesId: series.id,
      episodeCount: 2,
    });
    await friend.seasons.create({ ...emptySeason(), seriesId: series.id });
    seasonId = season.id;
  });

  describe('SeasonFillerRepository', () => {
    let seriesOfSeason: number;

    beforeEach(async () => {
      seriesOfSeason = (await owner.seasons.get(seasonId))!.seriesId;
    });

    it('round-trips the categories of a season and replaces them', async () => {
      expect(await owner.seasonFiller.get(seasonId)).toBeUndefined();
      const first: SeasonFiller = {
        seasonId,
        slug: 'show',
        categories: { '11': 'filler', '12': 'animeCanon' },
      };
      await owner.seasonFiller.replaceForSeries(seriesOfSeason, [first]);
      expect(await friend.seasonFiller.get(seasonId)).toEqual(first);
      const second: SeasonFiller = { seasonId, slug: 'other', categories: { '11': 'mixed' } };
      await owner.seasonFiller.replaceForSeries(seriesOfSeason, [second]);
      expect(await owner.seasonFiller.get(seasonId)).toEqual(second);
      expect(await harness.query('SELECT season_id FROM season_filler')).toHaveLength(1);
    });

    it('drops the seasons that are no longer in the replacement', async () => {
      await owner.seasonFiller.replaceForSeries(seriesOfSeason, [
        { seasonId, slug: 'show', categories: { '1': 'filler' } },
      ]);
      await owner.seasonFiller.replaceForSeries(seriesOfSeason, []);
      expect(await owner.seasonFiller.get(seasonId)).toBeUndefined();
    });

    it('disappears with its season', async () => {
      await owner.seasonFiller.replaceForSeries(seriesOfSeason, [
        { seasonId, slug: 'show', categories: { '1': 'filler' } },
      ]);
      await harness.run('DELETE FROM season WHERE id = ?', seasonId);
      expect(await harness.query('SELECT season_id FROM season_filler')).toEqual([]);
    });
  });

  describe('SeasonEpisodesRepository', () => {
    let seriesOfSeason: number;

    beforeEach(async () => {
      seriesOfSeason = (await owner.seasons.get(seasonId))!.seriesId;
    });

    it('round-trips a catalog and replaces it on a second put', async () => {
      expect(await owner.seasonEpisodes.get(seasonId)).toBeUndefined();
      await owner.seasonEpisodes.put(catalog(seasonId));
      expect(await owner.seasonEpisodes.get(seasonId)).toEqual(catalog(seasonId));
      await friend.seasonEpisodes.put(catalog(seasonId, 'Changed'));
      expect((await owner.seasonEpisodes.get(seasonId))?.episodes[0]?.title).toBe('Changed');
      expect(await harness.query('SELECT season_id FROM season_episodes')).toHaveLength(1);
    });

    it('disappears with its season', async () => {
      await owner.seasonEpisodes.put(catalog(seasonId));
      await harness.run('DELETE FROM season WHERE id = ?', seasonId);
      expect(await harness.query('SELECT season_id FROM season_episodes')).toEqual([]);
    });

    it('stores whether the catalog is complete and defaults to complete', async () => {
      await owner.seasonEpisodes.put({ ...catalog(seasonId), complete: false });
      expect((await owner.seasonEpisodes.get(seasonId))?.complete).toBe(false);
      await harness.run('DELETE FROM season_episodes');
      await harness.run(
        "INSERT INTO season_episodes (season_id, episodes, source, fetched_at) VALUES (?, '[]', 'tmdb', 'now')",
        seasonId,
      );
      expect((await owner.seasonEpisodes.get(seasonId))?.complete).toBe(true);
    });

    it('keeps a refill apart from the episodes and clears it on the next put', async () => {
      const refill = catalog(seasonId).episodes.slice(0, 1);
      await owner.seasonEpisodes.put({ ...catalog(seasonId), refill });
      expect((await owner.seasonEpisodes.get(seasonId))?.refill).toEqual(refill);
      await owner.seasonEpisodes.put(catalog(seasonId));
      expect((await owner.seasonEpisodes.get(seasonId))?.refill).toBeUndefined();
    });

    it('lists the catalogs of one series', async () => {
      expect(await owner.seasonEpisodes.listForSeries(seriesOfSeason)).toEqual([]);
      await owner.seasonEpisodes.put(catalog(seasonId));
      expect(
        (await owner.seasonEpisodes.listForSeries(seriesOfSeason)).map((row) => row.seasonId),
      ).toEqual([seasonId]);
      expect(await owner.seasonEpisodes.listForSeries(seriesOfSeason + 100)).toEqual([]);
    });

    it('refuses a source other than tmdb or jellyfin', async () => {
      await expect(
        harness.run(
          "INSERT INTO season_episodes (season_id, episodes, source, fetched_at) VALUES (?, '[]', 'x', 'now')",
          seasonId,
        ),
      ).rejects.toThrow();
    });
  });

  describe('EpisodeWatchRepository', () => {
    const watched = {
      '11': [{ startedAt: null, finishedAt: '2026-03-01' }],
      s1e2: [],
    };
    let seriesId: number;

    beforeEach(async () => {
      seriesId = (await owner.seasons.get(seasonId))!.seriesId;
    });

    it('has no row until the first set, then round-trips', async () => {
      expect(await owner.episodeWatches.get(seriesId)).toBeUndefined();
      await owner.episodeWatches.set(seriesId, watched);
      expect(await owner.episodeWatches.get(seriesId)).toEqual(watched);
      await owner.episodeWatches.set(seriesId, { '12': [] });
      expect(await owner.episodeWatches.get(seriesId)).toEqual({ '12': [] });
    });

    it('is private to each user, but listForSeries sees every user', async () => {
      await owner.episodeWatches.set(seriesId, watched);
      await friend.episodeWatches.set(seriesId, { '13': [] });
      expect(await owner.episodeWatches.get(seriesId)).toEqual(watched);
      expect(await friend.episodeWatches.get(seriesId)).toEqual({ '13': [] });
      expect(await owner.episodeWatches.list()).toEqual([
        { userId: 1, seriesId, watched, skipped: [], unmatched: [], lastActivityAt: null },
      ]);
      const all = await owner.episodeWatches.listForSeries(seriesId);
      expect(all.map((row) => row.userId)).toEqual([1, 2]);
    });

    it('stores the activity time when given and keeps it when a write has none', async () => {
      await owner.episodeWatches.set(seriesId, watched, [], undefined, '2026-03-05T12:00:00.000Z');
      await owner.episodeWatches.set(seriesId, { '12': [] });
      expect((await owner.episodeWatches.getEntry(seriesId))?.lastActivityAt).toBe(
        '2026-03-05T12:00:00.000Z',
      );
      await owner.episodeWatches.set(seriesId, watched, [], [], '2026-03-06T08:00:00.000Z');
      expect((await owner.episodeWatches.getEntry(seriesId))?.lastActivityAt).toBe(
        '2026-03-06T08:00:00.000Z',
      );
    });

    it('writes the season entries that follow the watches in the same step', async () => {
      await owner.episodeWatches.set(seriesId, watched, [
        {
          seasonId,
          watchedCount: 2,
          skippedCount: 1,
          completes: false,
          tracking: {
            status: 'in_progress',
            startedAt: '2026-03-01',
            finishedAt: null,
            rewatches: [{ startedAt: '2026-04-01', finishedAt: null }],
            wantsRewatch: false,
          },
        },
      ]);
      expect(await owner.seasons.get(seasonId)).toMatchObject({
        status: 'in_progress',
        startedAt: '2026-03-01',
        watchedCount: 2,
        skippedCount: 1,
        rewatches: [{ startedAt: '2026-04-01', finishedAt: null }],
      });
    });

    it('stores the skipped keys with the watches, and keeps them when only the watches are set', async () => {
      expect(await owner.episodeWatches.getSkipped(seriesId)).toEqual([]);
      await owner.episodeWatches.set(seriesId, watched, [], ['21', 's1e3']);
      expect(await owner.episodeWatches.getSkipped(seriesId)).toEqual(['21', 's1e3']);
      await owner.episodeWatches.set(seriesId, { '12': [] });
      expect(await owner.episodeWatches.getSkipped(seriesId)).toEqual(['21', 's1e3']);
      await owner.episodeWatches.set(seriesId, { '12': [] }, [], []);
      expect(await owner.episodeWatches.getSkipped(seriesId)).toEqual([]);
      expect(await friend.episodeWatches.getSkipped(seriesId)).toEqual([]);
    });

    it('replaces the rows of another user by id', async () => {
      await friend.episodeWatches.set(seriesId, { '11': [] });
      await owner.episodeWatches.replace(2, seriesId, { '14': [] });
      expect(await friend.episodeWatches.get(seriesId)).toEqual({ '14': [] });
    });

    it('reads a damaged stored value tolerantly', async () => {
      await harness.run(
        'INSERT INTO series_episode_entry (user_id, series_id, watched) VALUES (1, ?, \'{"1":"x","a":[],"s2e3":["2026-01-02"],"s2e0":[]}\')',
        seriesId,
      );
      expect(await owner.episodeWatches.get(seriesId)).toEqual({
        '1': [],
        s2e3: [{ startedAt: null, finishedAt: '2026-01-02' }],
      });
    });

    it('goes away with the series or the user', async () => {
      await owner.episodeWatches.set(seriesId, watched);
      await friend.episodeWatches.set(seriesId, watched);
      await harness.run('DELETE FROM user WHERE id = 2');
      expect(await harness.query('SELECT user_id FROM series_episode_entry')).toEqual([
        { user_id: 1 },
      ]);
      await harness.run('DELETE FROM series WHERE id = ?', seriesId);
      expect(await harness.query('SELECT user_id FROM series_episode_entry')).toEqual([]);
    });

    it('goes away when the user removes the series from their library', async () => {
      await owner.episodeWatches.set(seriesId, watched);
      await friend.episodeWatches.set(seriesId, watched);
      await friend.series.delete(seriesId);
      expect(await harness.query('SELECT user_id FROM series_episode_entry')).toEqual([
        { user_id: 1 },
      ]);
    });
  });

  describe('season cleanup', () => {
    it('drops the catalogs of every season of a series', async () => {
      await owner.seasonEpisodes.put(catalog(seasonId));
      await owner.seasonEpisodes.deleteForSeries((await owner.seasons.get(seasonId))!.seriesId);
      expect(await owner.seasonEpisodes.get(seasonId)).toBeUndefined();
    });

    it('sees personal data of any user, and nothing in an untouched season', async () => {
      expect(await owner.seasons.hasPersonalData(seasonId, [])).toBe(false);
      await friend.seasons.update(seasonId, { rating: 5 });
      expect(await owner.seasons.hasPersonalData(seasonId, [])).toBe(true);
    });

    it('counts status, dates, review and rewatches as personal data', async () => {
      const patches = [
        { status: 'completed' as const },
        { finishedAt: '2026-01-01' },
        { review: 'text' },
        { rewatches: [{ startedAt: null, finishedAt: '2026-02-01' }] },
      ];
      for (const patch of patches) {
        await owner.seasons.update(seasonId, patch);
        expect(await owner.seasons.hasPersonalData(seasonId, [])).toBe(true);
        await harness.run(
          "UPDATE season_entry SET status = 'planned', started_at = NULL, finished_at = NULL, review = NULL, rewatches = '[]'",
        );
        expect(await owner.seasons.hasPersonalData(seasonId, [])).toBe(false);
      }
    });

    it('deletes a season for everyone with its entries and catalog', async () => {
      await owner.seasonEpisodes.put(catalog(seasonId));
      await owner.seasons.deleteForAll(seasonId);
      expect(await harness.query('SELECT id FROM season')).toEqual([]);
      expect(await harness.query('SELECT user_id FROM season_entry')).toEqual([]);
      expect(await harness.query('SELECT season_id FROM season_episodes')).toEqual([]);
    });
  });
});
