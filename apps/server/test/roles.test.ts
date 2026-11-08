import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '@metrack/domain';
import type { Authenticator } from '../src/auth/Authenticator.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { fakeFetch } from './support/fakeFetch.js';

let api: TestApi;
let users: SqliteUserRepository;

/** Signs each request in as the stored user named by the `x-test-user` header, with their current role. */
const byHeader: Authenticator = {
  userFor: async (headers) => users.get(Number(headers.get('x-test-user'))),
};

beforeEach(async () => {
  api = await createTestApi(fakeFetch({}).fetch, {
    scope: new AsyncUserScope(),
    authenticator: byHeader,
  });
  users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Trusted', email: null });
  await users.create({ name: 'Normal', email: null });
  await users.setRole(2, 'trusted');
});

function as(userId: number) {
  const headers = { 'x-test-user': String(userId) };
  return {
    get: (url: string) => api.app.inject({ method: 'GET', url, headers }),
    post: (url: string, payload: object) =>
      api.app.inject({ method: 'POST', url, headers, payload }),
    patch: (url: string, payload: object) =>
      api.app.inject({ method: 'PATCH', url, headers, payload }),
    put: (url: string, payload: object) => api.app.inject({ method: 'PUT', url, headers, payload }),
  };
}

const owner = as(1);
const trusted = as(2);
const normal = as(3);

function ownerOf(table: string, id: number): unknown {
  return (
    api.db.prepare(`SELECT owner_id FROM ${table} WHERE id = ?`).get(id) as { owner_id: unknown }
  ).owner_id;
}

describe('user roles', () => {
  it('lets only the owner and trusted users add items by hand', async () => {
    for (const [client, status] of [
      [owner, 201],
      [trusted, 201],
      [normal, 403],
    ] as const) {
      const response = await client.post('/api/games', { title: 'Pokémon Añil' });
      expect(response.statusCode).toBe(status);
    }
    const refused = await normal.post('/api/books', { title: 'Fanfic', openLibraryId: 'OL1W' });
    expect(refused.json()).toEqual({
      error: 'Only trusted users can do this',
      code: 'trusted_only',
    });
    expect((await normal.get('/api/media')).json().total).toBe(0);
  });

  it('gives an item added by hand to its creator until it gets a provider id', async () => {
    const game = (await trusted.post('/api/games', { title: 'Randomlocke' })).json();
    expect(ownerOf('videogame', game.id)).toBe(2);
    const linked = (await owner.post('/api/movies', { title: 'Matrix', tmdbId: 603 })).json();
    expect(ownerOf('movie', linked.id)).toBeNull();

    const patched = await trusted.patch(`/api/games/${game.id}`, { igdbId: 1234 });
    expect(patched.statusCode).toBe(200);
    expect(ownerOf('videogame', game.id)).toBeNull();
  });

  it('keeps an item added by hand out of everyone else’s reach', async () => {
    const game = (await trusted.post('/api/games', { title: 'Randomlocke' })).json();
    for (const client of [owner, normal]) {
      expect((await client.get(`/api/games/${game.id}`)).statusCode).toBe(404);
      expect((await client.patch(`/api/games/${game.id}`, { title: 'Mine' })).statusCode).toBe(404);
    }
    expect((await trusted.get(`/api/games/${game.id}`)).json().title).toBe('Randomlocke');
  });

  it('applies the role at once, so a user made normal again cannot add by hand', async () => {
    expect((await owner.put('/api/users/2/role', { role: 'normal' })).json()).toEqual({
      id: 2,
      name: 'Trusted',
      email: null,
      role: 'normal',
    });
    expect((await trusted.post('/api/games', { title: 'x' })).statusCode).toBe(403);
    expect((await owner.put('/api/users/3/role', { role: 'trusted' })).statusCode).toBe(200);
    expect((await normal.post('/api/games', { title: 'x' })).statusCode).toBe(201);
  });

  it('lets only the owner change roles, never their own', async () => {
    expect((await trusted.put('/api/users/3/role', { role: 'trusted' })).json().code).toBe(
      'owner_only',
    );
    const own = await owner.put('/api/users/1/role', { role: 'normal' });
    expect(own.statusCode).toBe(400);
    expect(own.json().code).toBe('owner_role_fixed');
    expect((await owner.put('/api/users/3/role', { role: 'owner' })).statusCode).toBe(400);
    expect((await owner.put('/api/users/9/role', { role: 'trusted' })).statusCode).toBe(404);
    expect(
      (await owner.get('/api/users')).json().map((entry: { user: User }) => entry.user.role),
    ).toEqual(['owner', 'trusted', 'normal']);
  });
});

describe('the user roles migration', () => {
  it('makes user 1 the owner and gives each item added by hand to the user who has it', async () => {
    const db = new DatabaseSync(':memory:');
    const runner = new MigrationRunner(
      db,
      migrations.filter((migration) => migration.version < 14),
    );
    runner.run();
    db.exec(`
      INSERT INTO user (id, name, created_at) VALUES (2, 'Friend', '2026-11-07T00:00:00Z');
      INSERT INTO videogame (id, title) VALUES (1, 'Pokémon Añil'), (2, 'Hades');
      UPDATE videogame SET igdb_id = 113112 WHERE id = 2;
      INSERT INTO videogame_entry (user_id, videogame_id) VALUES (1, 1), (1, 2), (2, 2);
      INSERT INTO book (id, title) VALUES (1, 'Notes');
      INSERT INTO book_entry (user_id, book_id) VALUES (2, 1);
    `);
    new MigrationRunner(db, migrations).run();
    expect(db.prepare('SELECT id, role FROM user ORDER BY id').all()).toEqual([
      { id: 1, role: 'owner' },
      { id: 2, role: 'normal' },
    ]);
    expect(db.prepare('SELECT id, owner_id FROM videogame ORDER BY id').all()).toEqual([
      { id: 1, owner_id: 1 },
      { id: 2, owner_id: null },
    ]);
    expect(db.prepare('SELECT owner_id FROM book').get()).toEqual({ owner_id: 2 });
  });
});
