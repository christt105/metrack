import { beforeEach, describe, expect, it } from 'vitest';
import type { Authenticator } from '../src/auth/Authenticator.js';
import { runCatalogCommand } from '../src/account/runCatalogCommand.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { fakeFetch } from './support/fakeFetch.js';

let api: TestApi;
let users: SqliteUserRepository;

const byHeader: Authenticator = {
  userFor: async (headers) => users.get(Number(headers.get('x-test-user'))),
};

beforeEach(async () => {
  api = await createTestApi(fakeFetch({}).fetch, {
    scope: new AsyncUserScope(),
    authenticator: byHeader,
  });
  users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Tess', email: null });
  await users.create({ name: 'Tom', email: null });
  await users.create({ name: 'Nia', email: null });
  await users.setRole(2, 'trusted');
  await users.setRole(3, 'trusted');
});

function as(userId: number) {
  const headers = { 'x-test-user': String(userId) };
  return {
    get: (url: string) => api.app.inject({ method: 'GET', url, headers }),
    post: (url: string, payload: object) =>
      api.app.inject({ method: 'POST', url, headers, payload }),
    delete: (url: string) => api.app.inject({ method: 'DELETE', url, headers }),
  };
}

const owner = as(1);
const tess = as(2);
const tom = as(3);
const nia = as(4);

describe('deleting a hand-added item nobody has', () => {
  it('lists the unreferenced items: all for the owner, a trusted user own', async () => {
    const mine = (await tess.post('/api/games', { title: 'Mine' })).json();
    const theirs = (await tom.post('/api/books', { title: 'Theirs' })).json();
    const kept = (await tess.post('/api/games', { title: 'Still tracked' })).json();
    await tess.delete(`/api/games/${mine.id}`);
    await tom.delete(`/api/books/${theirs.id}`);

    const listed = (await owner.get('/api/catalog/unreferenced')).json();
    expect(listed).toEqual([]);
    expect(kept.id).toBeGreaterThan(0);
    api.db.exec('DELETE FROM videogame_entry');
    const asOwner = (await owner.get('/api/catalog/unreferenced')).json();
    expect(asOwner.map((item: { title: string }) => item.title)).toEqual(['Still tracked']);
    expect((await tom.get('/api/catalog/unreferenced')).json()).toEqual([]);
    expect((await tess.get('/api/catalog/unreferenced')).json()).toHaveLength(1);
  });

  it('removes an unreferenced item for the owner and for its trusted owner', async () => {
    const one = (await tess.post('/api/games', { title: 'One' })).json();
    const two = (await tess.post('/api/games', { title: 'Two' })).json();
    api.db.exec('DELETE FROM videogame_entry');
    expect((await tess.delete(`/api/catalog/games/${one.id}`)).statusCode).toBe(204);
    expect((await owner.delete(`/api/catalog/games/${two.id}`)).statusCode).toBe(204);
    expect(api.db.prepare('SELECT COUNT(*) AS n FROM videogame').get()).toEqual({ n: 0 });
  });

  it('refuses an item some user still has', async () => {
    const game = (await tess.post('/api/games', { title: 'Tracked' })).json();
    const response = await owner.delete(`/api/catalog/games/${game.id}`);
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('catalog_in_use');
  });

  it('does not let a trusted user touch another owner item, a shared title or a normal user at all', async () => {
    const game = (await tess.post('/api/games', { title: 'Tess game' })).json();
    api.db.exec('DELETE FROM videogame_entry');
    expect((await tom.delete(`/api/catalog/games/${game.id}`)).statusCode).toBe(404);
    expect((await nia.delete(`/api/catalog/games/${game.id}`)).statusCode).toBe(403);
    expect((await nia.get('/api/catalog/unreferenced')).statusCode).toBe(403);
    api.db.exec(
      "INSERT INTO videogame (igdb_id, title, genres, platforms) VALUES (9, 'Shared', '[]', '[]')",
    );
    const shared = api.db.prepare("SELECT id FROM videogame WHERE title = 'Shared'").get() as {
      id: number;
    };
    expect((await owner.delete(`/api/catalog/games/${shared.id}`)).statusCode).toBe(404);
    expect((await owner.delete('/api/catalog/seasons/1')).statusCode).toBe(400);
  });

  it('works from the command line', async () => {
    const game = (await tess.post('/api/games', { title: 'Orphan' })).json();
    expect(await runCatalogCommand({ dataDir: api.dir })).toBe(
      'No hand-added item is unreferenced',
    );
    await expect(
      runCatalogCommand({ dataDir: api.dir, delete: { collection: 'games', id: game.id } }),
    ).rejects.toThrow('Some user still has');
    api.db.exec('DELETE FROM videogame_entry');
    expect(await runCatalogCommand({ dataDir: api.dir })).toBe(
      `games  ${game.id}  Orphan  (owner 2)`,
    );
    expect(
      await runCatalogCommand({ dataDir: api.dir, delete: { collection: 'games', id: game.id } }),
    ).toBe(`Deleted games item ${game.id}`);
    await expect(
      runCatalogCommand({ dataDir: api.dir, delete: { collection: 'games', id: game.id } }),
    ).rejects.toThrow('There is no hand-added');
    await expect(
      runCatalogCommand({ dataDir: api.dir, delete: { collection: 'seasons', id: 1 } }),
    ).rejects.toThrow('Collection must be one of');
  });
});
