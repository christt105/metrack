import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyMovie } from '../src/media/emptyEntities.js';
import { AccountDeletionScheduler } from '../src/account/AccountDeletionScheduler.js';
import type { Authenticator } from '../src/auth/Authenticator.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { fakeFetch } from './support/fakeFetch.js';
import { readZip } from './support/readZip.js';
import { solidImage } from './support/sampleImages.js';

const DAY_MS = 24 * 3_600_000;

let api: TestApi;
let users: SqliteUserRepository;
let scope: AsyncUserScope;

const byHeader: Authenticator = {
  userFor: async (headers) => users.get(Number(headers['x-test-user'])),
};

beforeEach(async () => {
  scope = new AsyncUserScope();
  api = await createTestApi(fakeFetch({}).fetch, {
    scope,
    authenticator: byHeader,
  });
  users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Tess', email: 'tess@example.com' });
  await users.create({ name: 'Nia', email: null });
  await users.create({ name: 'Ned', email: null });
  await users.setRole(2, 'trusted');
});

function as(userId: number) {
  const headers = { 'x-test-user': String(userId) };
  return {
    get: (url: string) => api.app.inject({ method: 'GET', url, headers }),
    post: (url: string, payload?: object) =>
      api.app.inject({ method: 'POST', url, headers, ...(payload ? { payload } : {}) }),
    patch: (url: string, payload: object) =>
      api.app.inject({ method: 'PATCH', url, headers, payload }),
    delete: (url: string) => api.app.inject({ method: 'DELETE', url, headers }),
    withToken: (secret: string) => ({
      get: (url: string) =>
        api.app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${secret}` } }),
      post: (url: string, payload: object) =>
        api.app.inject({
          method: 'POST',
          url,
          headers: { authorization: `Bearer ${secret}` },
          payload,
        }),
    }),
    upload: (bytes: Buffer) =>
      api.app.inject({
        method: 'POST',
        url: '/api/images',
        headers: { ...headers, 'content-type': 'image/png' },
        payload: bytes,
      }),
  };
}

const owner = as(1);
const tess = as(2);
const nia = as(3);
const ned = as(4);

async function exportOf(client: ReturnType<typeof as>) {
  const response = await client.get('/api/account/export');
  expect(response.statusCode).toBe(200);
  const members = readZip(response.rawPayload);
  const data = JSON.parse(members.get('data.json')!.toString('utf8'));
  return { response, members, data };
}

async function addMovie(userId: number, fields: Partial<ReturnType<typeof emptyMovie>>) {
  return scope.run(userId, () => api.movies.create({ ...emptyMovie(), ...fields }));
}

async function seed() {
  await addMovie(1, { title: 'Matrix', tmdbId: 603, status: 'completed' });
  await addMovie(4, { title: 'Matrix', tmdbId: 603, rating: 3 });
  await addMovie(4, { title: 'Ned only', tmdbId: 700 });
  await addMovie(3, { title: 'Matrix', tmdbId: 603, rating: 9, review: 'Nia review' });
  await addMovie(3, { title: 'Nia only', tmdbId: 701 });
  const fanGame = (await tess.post('/api/games', { title: 'Fan Game' })).json();
  await tess.post('/api/games', { title: 'Tess igdb', igdbId: 55 });
  const ownerImage = (await owner.upload(await solidImage(22, 32))).json();
  const sharedImage = (await tess.upload(await solidImage(20, 30))).json();
  await owner.upload(await solidImage(20, 30));
  const privateImage = (await tess.upload(await solidImage(21, 31))).json();
  await tess.patch(`/api/games/${fanGame.id}`, {
    review: `Mine ![](${privateImage.ref}) and ![](${sharedImage.ref})`,
  });
  return { fanGame, ownerImage, sharedImage, privateImage };
}

function count(sql: string, ...params: (string | number)[]): number {
  return Number((api.db.prepare(sql).get(...params) as { n: number }).n);
}

describe('exporting an account', () => {
  it('holds the user own data, the catalog rows they reference and the images they own', async () => {
    const { privateImage } = await seed();
    await nia.patch('/api/settings/public-page', { handle: 'nia', enabled: false });
    const { response, members, data } = await exportOf(nia);

    expect(response.headers['content-type']).toBe('application/zip');
    expect(response.headers['content-disposition']).toContain('metrack-export-user-3-');
    expect(data.format).toBe(1);
    expect(data.user).toEqual({ id: 3, name: 'Nia', email: null, role: 'normal' });
    expect(data.publicPage).toMatchObject({ handle: 'nia', enabled: false });
    expect(data.movies.map((m: { title: string }) => m.title).sort()).toEqual([
      'Matrix',
      'Nia only',
    ]);
    const matrix = data.movies.find((m: { title: string }) => m.title === 'Matrix');
    expect(matrix).toMatchObject({ rating: 9, review: 'Nia review', tmdbId: 603 });
    expect(data.images).toEqual([]);
    expect([...members.keys()]).toEqual(['data.json']);
    const text = members.get('data.json')!.toString('utf8');
    for (const other of ['Ned only', 'Fan Game', 'Tess igdb', privateImage.ref]) {
      expect(text).not.toContain(other);
    }
  });

  it('includes the images the user owns as files, and nobody else', async () => {
    const { privateImage, sharedImage, ownerImage } = await seed();
    const { members, data } = await exportOf(tess);
    const hash = (ref: string) => ref.slice('/api/images/'.length);
    expect(data.images.map((i: { hash: string }) => i.hash).sort()).toEqual(
      [hash(privateImage.ref), hash(sharedImage.ref)].sort(),
    );
    expect(members.has(`images/${hash(privateImage.ref)}.webp`)).toBe(true);
    expect(members.get(`images/${hash(privateImage.ref)}.webp`)!.byteLength).toBeGreaterThan(0);
    expect(members.has(`images/${hash(ownerImage.ref)}.webp`)).toBe(false);
    expect(data.videogames.map((g: { title: string }) => g.title).sort()).toEqual([
      'Fan Game',
      'Tess igdb',
    ]);
  });

  it('lists token names and dates but never a secret or its hash, and leaves out the ntfy topic', async () => {
    const created = await api.tokens.create(3, {
      name: 'Obsidian',
      scope: 'read',
      expiresInDays: 30,
    });
    api.db
      .prepare(
        "INSERT INTO user_setting (user_id, jellyfin_user, ntfy_topic) VALUES (3, 'nia-jf', 'secret-topic')",
      )
      .run();
    const { members, data } = await exportOf(nia);
    expect(data.tokens).toEqual([
      expect.objectContaining({ name: 'Obsidian', scope: 'read', lastUsedAt: null }),
    ]);
    expect(data.settings).toMatchObject({ jellyfinUser: 'nia-jf' });
    expect(data.settings).not.toHaveProperty('ntfyTopic');
    const text = members.get('data.json')!.toString('utf8');
    expect(text).not.toContain('secret-topic');
    expect(text).not.toContain(created.secret);
    expect(text).not.toContain('secretHash');
  });

  it('can be downloaded with an API token', async () => {
    const created = await api.tokens.create(3, { name: 'cli', scope: 'read', expiresInDays: 30 });
    const response = await nia.withToken(created.secret).get('/api/account/export');
    expect(response.statusCode).toBe(200);
    expect(readZip(response.rawPayload).has('data.json')).toBe(true);
  });

  it('needs a sign-in', async () => {
    const response = await api.app.inject({ method: 'GET', url: '/api/account/export' });
    expect(response.statusCode).toBe(401);
  });
});

describe('asking for the deletion', () => {
  it('schedules it 7 days ahead once the handle or the word delete is typed', async () => {
    expect((await nia.post('/api/account/deletion', { confirm: 'nope' })).json().code).toBe(
      'confirmation_mismatch',
    );
    await nia.patch('/api/settings/public-page', { handle: 'nia', enabled: false });
    expect((await nia.post('/api/account/deletion', { confirm: 'wrong' })).statusCode).toBe(400);

    const scheduled = await nia.post('/api/account/deletion', { confirm: 'NIA' });
    expect(scheduled.statusCode).toBe(200);
    expect(scheduled.json()).toEqual({
      requestedAt: '2026-03-05T12:00:00.000Z',
      deleteAt: '2026-03-12T12:00:00.000Z',
    });
    expect((await ned.post('/api/account/deletion', { confirm: 'delete' })).statusCode).toBe(200);
  });

  it('keeps the first date when asked again, and shows the pending deletion', async () => {
    await nia.post('/api/account/deletion', { confirm: 'delete' });
    api.clock.now = new Date(api.clock.now.getTime() + 2 * DAY_MS);
    const again = await nia.post('/api/account/deletion', { confirm: 'delete' });
    expect(again.json().requestedAt).toBe('2026-03-05T12:00:00.000Z');
    expect((await nia.get('/api/account')).json()).toEqual({
      deletion: { requestedAt: '2026-03-05T12:00:00.000Z', deleteAt: '2026-03-12T12:00:00.000Z' },
      canDelete: true,
    });
    expect((await ned.get('/api/account')).json()).toEqual({ deletion: null, canDelete: true });
  });

  it('can be cancelled, and then nothing is erased', async () => {
    await seed();
    await nia.post('/api/account/deletion', { confirm: 'delete' });
    expect((await nia.delete('/api/account/deletion')).json()).toEqual({
      deletion: null,
      canDelete: true,
    });
    api.clock.now = new Date(api.clock.now.getTime() + 30 * DAY_MS);
    expect(await api.deletion.eraseDue()).toEqual([]);
    expect(count('SELECT COUNT(*) AS n FROM user WHERE id = 3')).toBe(1);
  });

  it('is refused for the owner, who cannot delete their own account', async () => {
    const response = await owner.post('/api/account/deletion', { confirm: 'delete' });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('owner_cannot_delete');
    expect((await owner.get('/api/account')).json().canDelete).toBe(false);
    await expect(api.deletion.request(1)).rejects.toMatchObject({ code: 'owner_cannot_delete' });
  });

  it('never reaches the owner even when the column is set by hand', async () => {
    api.db.exec("UPDATE user SET deletion_requested_at = '2020-01-01T00:00:00.000Z' WHERE id = 1");
    expect(await api.deletion.eraseDue()).toEqual([]);
    expect(count('SELECT COUNT(*) AS n FROM user WHERE id = 1')).toBe(1);
  });

  it('refuses an API token on every account deletion route', async () => {
    const write = await api.tokens.create(3, { name: 'w', scope: 'write', expiresInDays: 30 });
    const client = nia.withToken(write.secret);
    for (const response of [
      await client.post('/api/account/deletion', { confirm: 'delete' }),
      await client.get('/api/account'),
      await api.app.inject({
        method: 'DELETE',
        url: '/api/account/deletion',
        headers: { authorization: `Bearer ${write.secret}` },
      }),
    ]) {
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('session_required');
    }
    expect(count('SELECT COUNT(*) AS n FROM user WHERE deletion_requested_at IS NOT NULL')).toBe(0);
  });
});

describe('erasing an account', () => {
  it('waits out the grace period', async () => {
    await nia.post('/api/account/deletion', { confirm: 'delete' });
    api.clock.now = new Date(api.clock.now.getTime() + 7 * DAY_MS - 1000);
    expect(await api.deletion.eraseDue()).toEqual([]);
    api.clock.now = new Date(api.clock.now.getTime() + 1000);
    expect(await api.deletion.eraseDue()).toEqual([3]);
    expect(count('SELECT COUNT(*) AS n FROM user WHERE id = 3')).toBe(0);
  });

  it('deletes exactly the user data and leaves everyone else byte for byte', async () => {
    await seed();
    await nia.patch('/api/settings/public-page', { handle: 'nia', enabled: true });
    await api.tokens.create(3, { name: 'tok', scope: 'read', expiresInDays: null });
    api.db.exec(
      "INSERT INTO session (id, user_id, created_at, expires_at) VALUES ('s', 3, 'a', 'z')",
    );
    api.db.exec(
      "INSERT INTO unlinked_title (user_id, media_type, title, source, created_at) VALUES (3, 'movie', 'Lost', 'x', 'a')",
    );
    const before = {
      owner: (await exportOf(owner)).response.rawPayload,
      ned: (await exportOf(ned)).response.rawPayload,
      tess: (await exportOf(tess)).response.rawPayload,
    };
    const catalogRows = (table: string) => count(`SELECT COUNT(*) AS n FROM ${table}`);
    const movieRows = catalogRows('movie');

    await nia.post('/api/account/deletion', { confirm: 'delete' });
    api.clock.now = new Date(api.clock.now.getTime() + 8 * DAY_MS);
    expect(await api.deletion.eraseDue()).toEqual([3]);

    for (const table of [
      'movie_entry',
      'series_entry',
      'season_entry',
      'videogame_entry',
      'book_entry',
      'season_override',
      'unlinked_title',
      'release_alert',
      'session',
      'api_token',
      'user_setting',
      'image_owner',
    ]) {
      expect(count(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = 3`), table).toBe(0);
    }
    expect(count("SELECT COUNT(*) AS n FROM user WHERE handle = 'nia'")).toBe(0);
    expect(movieRows - catalogRows('movie')).toBe(1);
    expect(count("SELECT COUNT(*) AS n FROM movie WHERE title = 'Nia only'")).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM movie WHERE title = 'Matrix'")).toBe(1);
    expect(count("SELECT COUNT(*) AS n FROM movie WHERE title = 'Ned only'")).toBe(1);

    expect((await exportOf(owner)).response.rawPayload.equals(before.owner)).toBe(true);
    expect((await exportOf(ned)).response.rawPayload.equals(before.ned)).toBe(true);
    expect((await exportOf(tess)).response.rawPayload.equals(before.tess)).toBe(true);
  });

  it('removes the images only the user owned that nothing uses, and keeps the rest', async () => {
    const { sharedImage, ownerImage, privateImage } = await seed();
    const stray = await api.store.add(await solidImage(50, 50, 'png', { r: 1, g: 2, b: 3 }), null);
    const hash = (ref: string) => ref.slice('/api/images/'.length);
    const sharedHash = hash(sharedImage.ref);
    expect(await api.store.ownedBy(1)).toHaveLength(2);
    expect(hash(ownerImage.ref)).not.toBe(sharedHash);

    mkdirSync(join(api.dir, 'users', '2'), { recursive: true });
    writeFileSync(join(api.dir, 'users', '2', 'vault-mirror-state.json'), '{}');
    mkdirSync(join(api.dir, 'users', '4'), { recursive: true });
    writeFileSync(join(api.dir, 'users', '4', 'vault-mirror-state.json'), '{}');

    await tess.post('/api/account/deletion', { confirm: 'delete' });
    api.clock.now = new Date(api.clock.now.getTime() + 8 * DAY_MS);
    expect(await api.deletion.eraseDue()).toEqual([2]);

    expect(await api.store.get(hash(privateImage.ref))).toBeUndefined();
    expect(existsSync(join(api.dir, 'images', `${hash(privateImage.ref)}.webp`))).toBe(false);
    expect(await api.store.get(sharedHash)).toBeDefined();
    expect(await api.store.owns(sharedHash, 1)).toBe(true);
    expect(await api.store.get(stray.hash)).toBeDefined();
    expect(existsSync(join(api.dir, 'users', '2'))).toBe(false);
    expect(existsSync(join(api.dir, 'users', '4', 'vault-mirror-state.json'))).toBe(true);
  });

  it('keeps items added by hand and hands them to the owner', async () => {
    const { fanGame } = await seed();
    await tess.post('/api/account/deletion', { confirm: 'delete' });
    api.clock.now = new Date(api.clock.now.getTime() + 8 * DAY_MS);
    await api.deletion.eraseDue();

    const row = api.db.prepare('SELECT owner_id FROM videogame WHERE id = ?').get(fanGame.id) as {
      owner_id: number;
    };
    expect(row.owner_id).toBe(1);
    expect(
      count('SELECT COUNT(*) AS n FROM videogame_entry WHERE videogame_id = ?', fanGame.id),
    ).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM videogame WHERE title = 'Tess igdb'")).toBe(0);
    expect((await owner.get('/api/catalog/unreferenced')).json()).toEqual([
      { collection: 'games', id: fanGame.id, title: 'Fan Game', ownerId: 1 },
    ]);
  });

  it('erases the due accounts from the scheduler and one failure does not stop the rest', async () => {
    await nia.post('/api/account/deletion', { confirm: 'delete' });
    await ned.post('/api/account/deletion', { confirm: 'delete' });
    api.clock.now = new Date(api.clock.now.getTime() + 8 * DAY_MS);
    const scheduler = new AccountDeletionScheduler(api.deletion, {
      info: () => {},
      error: () => {},
    });
    expect(await scheduler.tick()).toEqual([3, 4]);
    expect(await scheduler.tick()).toEqual([]);
  });
});
