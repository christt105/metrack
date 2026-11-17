import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { SeasonEpisodes } from '@metrack/domain';
import { emptySeason, emptySeries } from '../src/media/emptyEntities.js';
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
    { number: 1, title, airDate: '2026-01-01', runtime: 24, tmdbId: 11, overview: 'Text' },
    { number: 2, title: null, airDate: null, runtime: null, tmdbId: null, overview: null },
  ],
  source: 'tmdb',
  fetchedAt: '2026-03-05T12:00:00.000Z',
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

  describe('SeasonEpisodesRepository', () => {
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
      '1': [{ startedAt: null, finishedAt: '2026-03-01' }],
      '2': [],
    };

    it('has no row until the first set, then round-trips', async () => {
      expect(await owner.episodeWatches.get(seasonId)).toBeUndefined();
      await owner.episodeWatches.set(seasonId, watched);
      expect(await owner.episodeWatches.get(seasonId)).toEqual(watched);
      await owner.episodeWatches.set(seasonId, { '2': [] });
      expect(await owner.episodeWatches.get(seasonId)).toEqual({ '2': [] });
    });

    it('keeps the watched count of the season entry in step', async () => {
      await owner.episodeWatches.set(seasonId, watched);
      expect((await owner.seasons.get(seasonId))?.watchedCount).toBe(2);
      await owner.episodeWatches.set(seasonId, {});
      expect((await owner.seasons.get(seasonId))?.watchedCount).toBe(0);
      expect((await friend.seasons.get(seasonId))?.watchedCount).toBe(0);
    });

    it('is private to each user, but listForSeason sees every user', async () => {
      await owner.episodeWatches.set(seasonId, watched);
      await friend.episodeWatches.set(seasonId, { '3': [] });
      expect(await owner.episodeWatches.get(seasonId)).toEqual(watched);
      expect(await friend.episodeWatches.get(seasonId)).toEqual({ '3': [] });
      expect(await owner.episodeWatches.list()).toEqual([{ userId: 1, seasonId, watched }]);
      const all = await owner.episodeWatches.listForSeason(seasonId);
      expect(all.map((row) => row.userId)).toEqual([1, 2]);
    });

    it('replaces the rows of another user by id', async () => {
      await friend.episodeWatches.set(seasonId, { '1': [] });
      await owner.episodeWatches.replace(2, seasonId, { '4': [] });
      expect(await friend.episodeWatches.get(seasonId)).toEqual({ '4': [] });
      expect((await friend.seasons.get(seasonId))?.watchedCount).toBe(1);
    });

    it('reads a damaged stored value tolerantly', async () => {
      await harness.run(
        'INSERT INTO season_episode_entry (user_id, season_id, watched) VALUES (1, ?, \'{"1":"x","a":[],"2":["2026-01-02"]}\')',
        seasonId,
      );
      expect(await owner.episodeWatches.get(seasonId)).toEqual({
        '1': [],
        '2': [{ startedAt: null, finishedAt: '2026-01-02' }],
      });
    });

    it('goes away with the season or the user', async () => {
      await owner.episodeWatches.set(seasonId, watched);
      await friend.episodeWatches.set(seasonId, watched);
      await harness.run('DELETE FROM user WHERE id = 2');
      expect(await harness.query('SELECT user_id FROM season_episode_entry')).toEqual([
        { user_id: 1 },
      ]);
      await harness.run('DELETE FROM season WHERE id = ?', seasonId);
      expect(await harness.query('SELECT user_id FROM season_episode_entry')).toEqual([]);
    });

    it('is not touched by a season catalog refresh', async () => {
      await owner.episodeWatches.set(seasonId, watched);
      await owner.seasons.updateCatalog(seasonId, { episodeCount: 9 });
      expect((await owner.seasons.get(seasonId))?.watchedCount).toBe(2);
    });
  });
});
