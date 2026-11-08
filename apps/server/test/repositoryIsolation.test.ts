import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { emptyBook, emptyMovie, emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import { SharedCatalogError } from '../src/storage/SharedCatalogError.js';
import type { Repositories } from '../src/storage/repositories/Repositories.js';
import { FixedUserScope } from '../src/users/FixedUserScope.js';
import { createBackends } from './support/backends.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import type { StorageHarness } from './support/StorageHarness.js';

const backends = createBackends();

afterAll(async () => {
  for (const backend of backends) await backend.dispose();
});

async function count(harness: StorageHarness, table: string): Promise<number> {
  return Number((await harness.query(`SELECT COUNT(*) AS n FROM ${table}`))[0]?.n);
}

describe.each(backends)('$name: users cannot reach each other', (backend) => {
  let harness: StorageHarness;
  let alice: Repositories;
  let bob: Repositories;

  beforeEach(async () => {
    harness = await backend.open();
    alice = harness.repositories(OWNER_SCOPE);
    const user = await alice.users.create({ name: 'Bob', email: null });
    bob = harness.repositories(new FixedUserScope(user.id));
  });

  it('keeps entries private while sharing the catalog row of the same title', async () => {
    const mine = await alice.movies.create({
      ...emptyMovie(),
      tmdbId: 603,
      title: 'Matrix',
      note: 'mine',
    });
    expect(await bob.movies.list()).toEqual([]);
    expect(await bob.movies.get(mine.id)).toBeUndefined();
    await expect(bob.movies.update(mine.id, { note: 'x' })).rejects.toThrow();
    await expect(bob.movies.override(mine.id, { title: 'x' })).rejects.toThrow();
    expect(await bob.movies.delete(mine.id)).toBe(false);
    expect(await bob.movies.findByTmdbId(603)).toBeUndefined();

    const theirs = await bob.movies.create({
      ...emptyMovie(),
      tmdbId: 603,
      title: 'Matrix',
      note: 'theirs',
    });
    expect(theirs.id).toBe(mine.id);
    expect((await alice.movies.get(mine.id))?.note).toBe('mine');
    expect((await bob.movies.get(mine.id))?.note).toBe('theirs');
    expect(await count(harness, 'movie')).toBe(1);
  });

  it('refuses catalog edits on a shared title, lets providers write them and personal edits through', async () => {
    const mine = await alice.movies.create({ ...emptyMovie(), tmdbId: 1, title: 'Old' });
    await bob.movies.create({ ...emptyMovie(), tmdbId: 1, title: 'Old' });
    await expect(alice.movies.update(mine.id, { title: 'New' })).rejects.toBeInstanceOf(
      SharedCatalogError,
    );
    expect((await alice.movies.update(mine.id, { rating: 7, follow: true })).rating).toBe(7);
    await expect(alice.movies.updateCatalog(mine.id, { rating: 3 })).rejects.toThrow(
      'Not catalog columns',
    );
    await alice.movies.updateCatalog(mine.id, { title: 'New' });
    expect((await bob.movies.get(mine.id))?.title).toBe('New');
    expect((await bob.movies.get(mine.id))?.rating).toBeNull();
    expect((await bob.movies.listFollowed()).length).toBe(0);
    expect((await alice.movies.listFollowed()).length).toBe(1);
  });

  it('keeps the catalog row until the last user drops the title', async () => {
    const mine = await alice.movies.create({ ...emptyMovie(), tmdbId: 5, title: 'Shared' });
    await bob.movies.create({ ...emptyMovie(), tmdbId: 5, title: 'Shared' });
    expect(await alice.movies.delete(mine.id)).toBe(true);
    expect(await count(harness, 'movie')).toBe(1);
    expect(await bob.movies.get(mine.id)).toMatchObject({ title: 'Shared' });
    expect(await bob.movies.delete(mine.id)).toBe(true);
    expect(await count(harness, 'movie')).toBe(0);
  });

  it('records hand edits for one user only and lets them be cleared', async () => {
    const mine = await alice.movies.create({ ...emptyMovie(), tmdbId: 9, title: 'Catalog' });
    await bob.movies.create({ ...emptyMovie(), tmdbId: 9, title: 'Catalog' });
    await alice.movies.override(mine.id, { title: 'Mine' });
    expect((await alice.movies.get(mine.id))?.title).toBe('Mine');
    expect((await bob.movies.get(mine.id))?.title).toBe('Catalog');
    expect(await alice.movies.overriddenFields(mine.id)).toEqual(['title']);
    expect(await bob.movies.overriddenFields(mine.id)).toEqual([]);
    await alice.movies.updateCatalog(mine.id, { title: 'Refreshed' });
    expect((await alice.movies.get(mine.id))?.title).toBe('Mine');
    expect((await alice.movies.update(mine.id, { title: 'Again' })).title).toBe('Again');
    expect((await alice.movies.clearOverride(mine.id, 'title')).title).toBe('Refreshed');
  });

  it('gives a hand-added item to its creator until it gets a provider id', async () => {
    const mine = await alice.movies.create({ ...emptyMovie(), title: 'Home video' });
    const row = async () =>
      (await harness.query('SELECT owner_id FROM movie WHERE id = ?', mine.id))[0]?.owner_id;
    expect(await row()).toBe(1);
    const other = await bob.movies.create({ ...emptyMovie(), title: 'Home video' });
    expect(other.id).not.toBe(mine.id);
    const keyed = await alice.movies.update(mine.id, { tmdbId: 77 });
    expect(keyed.tmdbId).toBe(77);
    expect(await row()).toBeNull();
    expect((await bob.movies.create({ ...emptyMovie(), tmdbId: 77, title: 'x' })).id).toBe(mine.id);
  });

  it('removes only the deleting user season entries and overrides with a series', async () => {
    const series = await alice.series.create({ ...emptySeries(), tmdbId: 10, title: 'Lupin' });
    await bob.series.create({ ...emptySeries(), tmdbId: 10, title: 'Lupin' });
    const season = await alice.seasons.create({ ...emptySeason(), seriesId: series.id });
    expect(await bob.seasons.listBySeries(series.id)).toEqual([]);
    await bob.seasons.create({ ...emptySeason(), seriesId: series.id });
    await alice.overrides.set({
      seriesId: series.id,
      tmdbSeasonNumber: 1,
      number: 2,
      title: null,
      jellyfinSeasonId: null,
    });
    expect(await bob.overrides.listBySeries(series.id)).toEqual([]);
    expect(await bob.overrides.delete(series.id, 1)).toBe(false);

    expect(await alice.series.delete(series.id)).toBe(true);
    expect(await alice.seasons.get(season.id)).toBeUndefined();
    expect(await alice.overrides.listBySeries(series.id)).toEqual([]);
    expect(await bob.seasons.listBySeries(series.id)).toHaveLength(1);
    expect(await bob.series.findByTmdbId(10)).toMatchObject({ title: 'Lupin' });
    expect(await count(harness, 'series')).toBe(1);
  });

  it('scopes the inbox, sent alerts and metadata state to the user', async () => {
    const unlinked = {
      mediaType: 'movie' as const,
      title: 'X',
      year: null,
      source: 'jellyfin',
      sourceRef: '/x',
      createdAt: 'now',
    };
    const item = await alice.unlinked.create(unlinked);
    expect(await bob.unlinked.list()).toEqual([]);
    expect(await bob.unlinked.findBySourceRef('jellyfin', '/x')).toBeUndefined();
    expect(await alice.unlinked.findBySourceRef('jellyfin', '/x')).toEqual(item);
    expect(await bob.unlinked.delete(item.id)).toBe(false);
    await expect(bob.unlinked.update(item.id, { title: 'Y' })).rejects.toThrow();

    const alert = {
      subjectType: 'movie' as const,
      subjectId: 1,
      kind: 'releases_today' as const,
      title: 'M',
      message: 'm',
      sentAt: 'now',
    };
    expect(await alice.releaseAlerts.record(alert)).toBe(true);
    expect(await alice.releaseAlerts.record(alert)).toBe(false);
    expect(await bob.releaseAlerts.record(alert)).toBe(true);
    expect(await alice.releaseAlerts.keysFor('movie', 1)).toEqual([
      { subjectType: 'movie', subjectId: 1, kind: 'releases_today' },
    ]);
    expect(await count(harness, 'release_alert')).toBe(2);

    const movie = await alice.movies.create({ ...emptyMovie(), tmdbId: 3, title: 'M' });
    await alice.movies.override(movie.id, { title: 'Edited' });
    await alice.metadataStates.markFetched('movie', movie.id, '2026-01-01', 'hash');
    expect(await alice.metadataStates.get('movie', movie.id)).toEqual({
      fetchedAt: '2026-01-01',
      metadataHash: 'hash',
      editedFields: ['title'],
    });
    await expect(bob.metadataStates.get('movie', movie.id)).rejects.toThrow('not found');
  });

  it('leaves no catalog row behind when the entry cannot be stored', async () => {
    await expect(
      alice.books.create({ ...emptyBook(), openLibraryId: 'OL9M', title: 'B', rating: 11 }),
    ).rejects.toThrow();
    expect(await count(harness, 'book')).toBe(0);
    expect(await alice.books.list()).toEqual([]);
  });
});
