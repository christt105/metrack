import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { emptyBook, emptyMovie, emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import { imageRef } from '../src/images/imageRef.js';
import type { StoredImage } from '../src/images/StoredImage.js';
import { HandleTakenError } from '../src/storage/HandleTakenError.js';
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

const image = (hash: string, over: Partial<StoredImage> = {}): StoredImage => ({
  hash,
  ref: imageRef(hash),
  extension: 'png',
  mimeType: 'image/png',
  width: 10,
  height: 20,
  byteSize: 100,
  sourceUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe.each(backends)('$name: accounts and settings', (backend) => {
  let harness: StorageHarness;
  let repos: Repositories;

  beforeEach(async () => {
    harness = await backend.open();
    repos = harness.repositories(OWNER_SCOPE);
  });

  it('stores users, roles and per-user settings', async () => {
    expect(await repos.users.list()).toEqual([
      { id: 1, name: 'Owner', email: null, role: 'owner' },
    ]);
    const friend = await repos.users.create({ name: 'Friend', email: 'f@example.com' });
    expect(friend).toEqual({ id: 2, name: 'Friend', email: 'f@example.com', role: 'normal' });
    await repos.users.setRole(2, 'trusted');
    expect((await repos.users.get(2))?.role).toBe('trusted');
    expect(await repos.users.get(99)).toBeUndefined();

    expect(await repos.settings.get(2)).toBeUndefined();
    const settings = {
      jellyfinUser: 'friend',
      ntfyTopic: 'topic',
      publishProject: null,
      publishBaseUrl: null,
      mirrorDir: null,
      mirrorLinkPrefix: null,
    };
    await repos.settings.save(2, settings);
    await repos.settings.save(2, { ...settings, ntfyTopic: 'other' });
    expect(await repos.settings.get(2)).toEqual({ ...settings, ntfyTopic: 'other' });
    expect(await repos.settings.list()).toEqual([
      { userId: 2, settings: { ...settings, ntfyTopic: 'other' } },
    ]);
  });

  it('keeps public pages and handles, unique without regard to case', async () => {
    await repos.users.create({ name: 'Friend', email: null });
    expect((await repos.profiles.get(1)).handle).toBeNull();
    const page = {
      handle: 'Owner',
      enabled: true,
      avatar: null,
      intro: 'Hi',
      description: null,
      about: null,
      giscus: { repo: 'a/b', repoId: 'R', category: 'C', categoryId: 'CI' },
    };
    await repos.profiles.save(1, page);
    expect(await repos.profiles.get(1)).toEqual({ ...page, handle: 'owner' });
    expect(await repos.profiles.findByHandle('OWNER')).toEqual({ userId: 1, enabled: true });
    expect(await repos.profiles.findByHandle('nobody')).toBeUndefined();
    await expect(repos.profiles.save(2, { ...page, handle: 'owner' })).rejects.toBeInstanceOf(
      HandleTakenError,
    );
    await repos.profiles.save(1, { ...page, enabled: false, giscus: null });
    expect(await repos.profiles.get(1)).toMatchObject({ enabled: false, giscus: null });
  });

  it('stores sessions and drops the expired ones', async () => {
    await repos.sessions.create({
      id: 'old',
      userId: 1,
      createdAt: '2026-01-01',
      expiresAt: '2026-01-02',
    });
    await repos.sessions.create({
      id: 'new',
      userId: 1,
      createdAt: '2026-01-01',
      expiresAt: '2026-03-01',
    });
    await repos.sessions.deleteExpired('2026-02-01');
    expect(await repos.sessions.get('old')).toBeUndefined();
    expect((await repos.sessions.get('new'))?.userId).toBe(1);
    await repos.sessions.delete('new');
    expect(await repos.sessions.get('new')).toBeUndefined();
  });

  it('stores API tokens per user', async () => {
    await repos.users.create({ name: 'Friend', email: null });
    const first = await repos.apiTokens.create({
      userId: 1,
      name: 'a',
      secretHash: 'h1',
      scope: 'read',
      createdAt: '2026-01-01',
      expiresAt: null,
    });
    const second = await repos.apiTokens.create({
      userId: 1,
      name: 'b',
      secretHash: 'h2',
      scope: 'write',
      createdAt: '2026-01-02',
      expiresAt: '2027-01-01',
    });
    expect((await repos.apiTokens.listForUser(1)).map((t) => t.id)).toEqual([second.id, first.id]);
    expect(await repos.apiTokens.listForUser(2)).toEqual([]);
    expect(await repos.apiTokens.bySecretHash('h1')).toMatchObject({ userId: 1, secretHash: 'h1' });
    expect(await repos.apiTokens.bySecretHash('nope')).toBeUndefined();
    await repos.apiTokens.markUsed(first.id, '2026-05-05');
    expect((await repos.apiTokens.listForUser(1)).find((t) => t.id === first.id)?.lastUsedAt).toBe(
      '2026-05-05',
    );
    expect(await repos.apiTokens.delete(2, first.id)).toBe(false);
    expect(await repos.apiTokens.delete(1, first.id)).toBe(true);
  });

  it('tracks account deletion requests', async () => {
    await repos.users.create({ name: 'Friend', email: null });
    expect(await repos.accounts.deletionRequestedAt(2)).toBeNull();
    expect(await repos.accounts.requestDeletion(2, '2026-01-01')).toBe('2026-01-01');
    expect(await repos.accounts.requestDeletion(2, '2026-02-02')).toBe('2026-01-01');
    await repos.accounts.requestDeletion(1, '2026-01-01');
    expect(await repos.accounts.dueForDeletion('2026-01-31')).toEqual([2]);
    expect(await repos.accounts.dueForDeletion('2025-12-31')).toEqual([]);
    expect(await repos.accounts.cancelDeletion(2)).toBe(true);
    expect(await repos.accounts.cancelDeletion(2)).toBe(false);
  });

  it('erases an account and what only it held, keeping everyone else data', async () => {
    const friend = await repos.users.create({ name: 'Friend', email: null });
    const bob = harness.repositories(new FixedUserScope(friend.id));
    const shared = await repos.movies.create({ ...emptyMovie(), tmdbId: 1, title: 'Shared' });
    await bob.movies.create({ ...emptyMovie(), tmdbId: 1, title: 'Shared' });
    await bob.movies.create({ ...emptyMovie(), tmdbId: 2, title: 'Only Bob' });
    const handAdded = await bob.books.create({ ...emptyBook(), title: 'Diary' });
    const series = await bob.series.create({ ...emptySeries(), tmdbId: 3, title: 'Gone' });
    await bob.seasons.create({ ...emptySeason(), seriesId: series.id });
    const kept = await repos.series.create({ ...emptySeries(), tmdbId: 4, title: 'Kept' });
    await bob.series.create({ ...emptySeries(), tmdbId: 4, title: 'Kept' });
    await repos.series.create({ ...emptySeries(), tmdbId: 5, title: 'Season only' });
    await bob.overrides.set({
      seriesId: series.id,
      tmdbSeasonNumber: 1,
      number: null,
      title: null,
      jellyfinSeasonId: null,
    });
    await bob.unlinked.create({
      mediaType: 'movie',
      title: 'U',
      year: null,
      source: 's',
      sourceRef: null,
      createdAt: 'now',
    });
    await repos.images.insert(image('aa'));
    await repos.images.addOwner('aa', friend.id, '2026-01-01');
    await repos.sessions.create({
      id: 's',
      userId: friend.id,
      createdAt: 'now',
      expiresAt: 'later',
    });

    await expect(repos.accounts.erase(1)).rejects.toThrow('owner');
    expect(await repos.accounts.erase(friend.id)).toEqual(['aa']);

    expect(await repos.users.get(friend.id)).toBeUndefined();
    expect(await repos.movies.get(shared.id)).toMatchObject({ title: 'Shared' });
    expect(await repos.series.get(kept.id)).toMatchObject({ title: 'Kept' });
    expect(
      (await harness.query('SELECT title FROM movie ORDER BY id')).map((r) => r.title),
    ).toEqual(['Shared']);
    expect(
      (await harness.query('SELECT title FROM series ORDER BY id')).map((r) => r.title),
    ).toEqual(['Kept', 'Season only']);
    expect(
      (await harness.query('SELECT owner_id FROM book WHERE id = ?', handAdded.id))[0],
    ).toEqual({
      owner_id: 1,
    });
    for (const table of ['season', 'season_override', 'unlinked_title', 'session', 'image_owner']) {
      expect(await count(harness, table), table).toBe(0);
    }
    expect(await count(harness, 'movie_entry')).toBe(1);
  });
});

describe.each(backends)('$name: hand-added catalog rows and images', (backend) => {
  let harness: StorageHarness;
  let repos: Repositories;

  beforeEach(async () => {
    harness = await backend.open();
    repos = harness.repositories(OWNER_SCOPE);
  });

  it('lists, finds and deletes hand-added rows nobody references', async () => {
    const friend = await repos.users.create({ name: 'Friend', email: null });
    const bob = harness.repositories(new FixedUserScope(friend.id));
    const mine = await repos.movies.create({ ...emptyMovie(), title: 'Mine' });
    const theirs = await bob.books.create({ ...emptyBook(), title: 'Theirs' });
    const provider = await repos.movies.create({ ...emptyMovie(), tmdbId: 1, title: 'Provider' });
    expect(await repos.handAddedCatalog.listUnreferenced()).toEqual([]);
    expect(await repos.handAddedCatalog.find('movies', mine.id)).toEqual({
      ownerId: 1,
      referenced: true,
    });
    expect(await repos.handAddedCatalog.find('movies', provider.id)).toBeUndefined();
    await repos.movies.delete(mine.id);
    await harness.run('INSERT INTO movie (id, title, owner_id) VALUES (500, ?, 1)', 'Loose');
    await harness.run('DELETE FROM book_entry WHERE book_id = ?', theirs.id);
    expect(await repos.handAddedCatalog.listUnreferenced()).toEqual([
      { collection: 'movies', id: 500, title: 'Loose', ownerId: 1 },
      { collection: 'books', id: theirs.id, title: 'Theirs', ownerId: friend.id },
    ]);
    expect((await repos.handAddedCatalog.listUnreferenced(1)).map((i) => i.id)).toEqual([500]);
    await repos.handAddedCatalog.delete('movies', 500);
    expect(await repos.handAddedCatalog.find('movies', 500)).toBeUndefined();
  });

  it('stores images, their sources and owners', async () => {
    const friend = await repos.users.create({ name: 'Friend', email: null });
    await repos.images.insert(image('aa', { sourceUrl: 'https://x/a.png', byteSize: 10 }));
    await repos.images.insert(image('aa', { byteSize: 999 }));
    await repos.images.insert(image('bb', { createdAt: '2026-02-01T00:00:00.000Z', byteSize: 30 }));
    expect((await repos.images.get('aa'))?.byteSize).toBe(10);
    expect(await repos.images.get('zz')).toBeUndefined();
    expect((await repos.images.list()).map((i) => i.hash)).toEqual(['aa', 'bb']);

    await repos.images.addSource('https://x/b.png', 'bb');
    await repos.images.addSource('https://x/b.png', 'bb');
    expect(await repos.images.listSources()).toEqual([{ url: 'https://x/b.png', hash: 'bb' }]);
    expect((await repos.images.findBySourceUrl('https://x/a.png'))?.hash).toBe('aa');
    expect((await repos.images.findBySourceUrl('https://x/b.png'))?.hash).toBe('bb');
    expect(await repos.images.findBySourceUrl('https://x/none')).toBeUndefined();

    await repos.images.addOwner('aa', friend.id, '2026-03-01');
    await repos.images.addOwner('aa', friend.id, '2026-03-01');
    await repos.images.addOwner('bb', friend.id, '2026-03-02');
    expect(await repos.images.ownerIds('aa')).toEqual([friend.id]);
    expect((await repos.images.ownedBy(friend.id)).map((i) => i.hash)).toEqual(['aa', 'bb']);
    expect(await repos.images.usedBytes(friend.id)).toBe(40);
    expect(await repos.images.usedBytes(1)).toBe(0);
  });

  it('finds unreferenced images and clears references when one is deleted', async () => {
    await repos.images.insert(image('aa'));
    await repos.images.insert(image('bb'));
    await repos.images.insert(image('cc', { createdAt: '2026-06-01T00:00:00.000Z' }));
    await repos.images.insert(image('dd'));
    await repos.images.addSource('https://x/d.png', 'dd');
    const movie = await repos.movies.create({
      ...emptyMovie(),
      tmdbId: 1,
      title: 'M',
      cover: imageRef('aa'),
      review: `see ${imageRef('bb')}`,
    });
    const book = await repos.books.create({ ...emptyBook(), openLibraryId: 'OL1M', title: 'B' });
    await repos.books.override(book.id, { cover: imageRef('cc') });
    await repos.movies.update(movie.id, { banner: 'https://x/d.png' });

    expect(await repos.images.orphans()).toEqual([]);
    await repos.books.clearOverride(book.id, 'cover');
    expect(await repos.images.orphans()).toEqual(['cc']);
    expect(await repos.images.orphans('2026-03-01T00:00:00.000Z')).toEqual([]);
    expect(await repos.images.orphans('2026-12-01T00:00:00.000Z')).toEqual(['cc']);

    expect(await repos.images.isShownByCatalog('aa')).toBe(true);
    expect(await repos.images.isShownByCatalog('cc')).toBe(false);
    const hand = await repos.movies.create({
      ...emptyMovie(),
      title: 'Hand',
      cover: imageRef('cc'),
    });
    expect(await repos.images.isShownByCatalog('cc')).toBe(false);
    expect(hand.cover).toBe(imageRef('cc'));

    await repos.images.delete('aa');
    expect(await repos.images.get('aa')).toBeUndefined();
    expect((await repos.movies.get(movie.id))?.cover).toBeNull();
    const withOverride = await repos.movies.override(movie.id, { cover: imageRef('bb') });
    expect(withOverride.cover).toBe(imageRef('bb'));
    await repos.images.delete('bb');
    expect((await repos.movies.get(movie.id))?.cover).toBeNull();
  });
});
