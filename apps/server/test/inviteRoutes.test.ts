import { beforeEach, describe, expect, it } from 'vitest';
import type { Authenticator } from '../src/auth/Authenticator.js';
import { hashSecret } from '../src/auth/hashSecret.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { fakeFetch } from './support/fakeFetch.js';
import { solidImage } from './support/sampleImages.js';

const DAY_MS = 24 * 3_600_000;

let api: TestApi;
let users: SqliteUserRepository;

const byHeader: Authenticator = {
  userFor: async (headers) => users.get(Number(headers.get('x-test-user'))),
};

function as(userId: number) {
  const headers = { 'x-test-user': String(userId) };
  return {
    get: (url: string) => api.app.inject({ method: 'GET', url, headers }),
    post: (url: string, payload?: object) =>
      api.app.inject({ method: 'POST', url, headers, ...(payload ? { payload } : {}) }),
    delete: (url: string) => api.app.inject({ method: 'DELETE', url, headers }),
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
const friend = as(2);
const guest = { get: (url: string) => api.app.inject({ method: 'GET', url }) };

beforeEach(async () => {
  api = await createTestApi(fakeFetch({}).fetch, {
    authenticator: byHeader,
    scope: new AsyncUserScope(),
  });
  users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Friend', email: 'friend@example.com' });
});

describe('invitation routes', () => {
  it('lets the owner create, list and revoke links and answers the code once', async () => {
    const created = await owner.post('/api/invites', { maxUses: 4, expiresInDays: 3 });
    expect(created.statusCode).toBe(201);
    const { invite, code } = created.json();
    expect(invite).toMatchObject({ maxUses: 4, uses: 0, status: 'valid' });
    expect(invite.expiresAt).toBe(new Date(api.clock.now.getTime() + 3 * DAY_MS).toISOString());
    const listed = (await owner.get('/api/invites')).json();
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(code);
    expect(await owner.delete(`/api/invites/${invite.id}`)).toMatchObject({ statusCode: 204 });
    expect((await owner.get('/api/invites')).json()[0]).toMatchObject({ status: 'revoked' });
    expect((await owner.delete(`/api/invites/${invite.id}`)).statusCode).toBe(409);
  });

  it('defaults to seven days and validates the body', async () => {
    const { invite } = (await owner.post('/api/invites', { maxUses: 1 })).json();
    expect(invite.expiresAt).toBe(new Date(api.clock.now.getTime() + 7 * DAY_MS).toISOString());
    expect((await owner.post('/api/invites', { maxUses: 0 })).statusCode).toBe(400);
    expect((await owner.post('/api/invites', { maxUses: 2, expiresInDays: 500 })).statusCode).toBe(
      400,
    );
    expect((await owner.post('/api/invites', {})).statusCode).toBe(400);
  });

  it('keeps management owner-only and refuses personal API tokens', async () => {
    expect((await friend.get('/api/invites')).statusCode).toBe(403);
    expect((await friend.post('/api/invites', { maxUses: 1 })).statusCode).toBe(403);
    expect((await friend.delete('/api/invites/1')).statusCode).toBe(403);
    expect((await guest.get('/api/invites')).statusCode).toBe(401);
    const { secret } = await api.tokens.create(1, { name: 't', scope: 'write', expiresInDays: 30 });
    const withToken = await api.app.inject({
      method: 'GET',
      url: '/api/invites',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(withToken.statusCode).toBe(403);
  });

  it('previews a link publicly, without a session and without spending anything', async () => {
    const { code } = (await owner.post('/api/invites', { maxUses: 1 })).json();
    const preview = await guest.get(`/api/invites/${code}`);
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toEqual({ status: 'valid', inviter: 'Owner' });
    await guest.get(`/api/invites/${code}`);
    expect((await owner.get('/api/invites')).json()[0].uses).toBe(0);
    expect((await guest.get('/api/invites/nonsense')).json()).toEqual({
      status: 'unknown',
      inviter: '',
    });
  });

  it('shows a clear status for an expired and a revoked link', async () => {
    const expiring = (await owner.post('/api/invites', { maxUses: 1, expiresInDays: 1 })).json();
    const revoked = (await owner.post('/api/invites', { maxUses: 1 })).json();
    await owner.delete(`/api/invites/${revoked.invite.id}`);
    api.clock.now = new Date(api.clock.now.getTime() + 2 * DAY_MS);
    expect((await guest.get(`/api/invites/${expiring.code}`)).json().status).toBe('expired');
    expect((await guest.get(`/api/invites/${revoked.code}`)).json().status).toBe('revoked');
  });
});

describe('first entry', () => {
  async function newcomer() {
    const { code } = (await owner.post('/api/invites', { maxUses: 1 })).json();
    const repository = (await import('../src/storage/sqlite/SqliteInviteRepository.js'))
      .SqliteInviteRepository;
    const created = await new repository(api.db).redeem({
      codeHash: hashSecret(code),
      name: 'Google Name',
      email: 'new@example.com',
      googleSub: 'new-sub',
      at: api.clock.now.toISOString(),
    });
    return as(created!.id);
  }

  it('says a joined user still has to confirm, and an existing one does not', async () => {
    const joined = await newcomer();
    expect((await joined.get('/api/account')).json().needsWelcome).toBe(true);
    expect((await friend.get('/api/account')).json().needsWelcome).toBe(false);
  });

  it('stores the confirmed name and handle with the settings validation', async () => {
    const joined = await newcomer();
    expect(
      (await joined.post('/api/account/welcome', { name: 'Ana', handle: 'Bad Handle' })).statusCode,
    ).toBe(400);
    expect(
      (await joined.post('/api/account/welcome', { name: '  ', handle: 'ana' })).statusCode,
    ).toBe(400);
    expect(
      (await joined.post('/api/account/welcome', { name: 'Ana', handle: '' })).statusCode,
    ).toBe(400);
    expect((await joined.get('/api/account')).json().needsWelcome).toBe(true);
    const done = await joined.post('/api/account/welcome', { name: ' Ana ', handle: ' ANA ' });
    expect(done.statusCode).toBe(200);
    expect(done.json()).toMatchObject({ name: 'Ana', email: 'new@example.com' });
    expect((await joined.get('/api/account')).json().needsWelcome).toBe(false);
    expect((await joined.get('/api/settings')).json().publicPage).toMatchObject({
      handle: 'ana',
      enabled: false,
    });
    expect(
      (await joined.post('/api/account/welcome', { name: 'Ana', handle: 'ana2' })).statusCode,
    ).toBe(409);
  });

  it('refuses a handle another user has', async () => {
    await friend.post('/api/account/welcome', { name: 'x', handle: 'taken' });
    const joined = await newcomer();
    await api.app.inject({
      method: 'PATCH',
      url: '/api/settings/public-page',
      headers: { 'x-test-user': '1' },
      payload: { handle: 'taken' },
    });
    const clash = await joined.post('/api/account/welcome', { name: 'Ana', handle: 'taken' });
    expect(clash.statusCode).toBe(409);
    expect((await joined.get('/api/account')).json().needsWelcome).toBe(true);
  });
});

describe('users panel', () => {
  it('lists every account with email, sign-up date and storage, to the owner only', async () => {
    await users.setRole(2, 'trusted');
    await friend.upload(await solidImage(20, 30));
    expect((await friend.get('/api/users/summary')).statusCode).toBe(403);
    const list = (await owner.get('/api/users/summary')).json();
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({
      id: 2,
      name: 'Friend',
      email: 'friend@example.com',
      role: 'trusted',
      deletion: null,
    });
    expect(list[1].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(list[1].usedBytes).toBeGreaterThan(0);
    expect(list[0].usedBytes).toBe(0);
  });

  it('schedules a deletion with the grace period, never immediately, and can cancel it', async () => {
    const scheduled = await owner.post('/api/users/2/deletion');
    expect(scheduled.statusCode).toBe(200);
    expect(scheduled.json().deleteAt).toBe(
      new Date(api.clock.now.getTime() + 7 * DAY_MS).toISOString(),
    );
    expect((await users.get(2))?.name).toBe('Friend');
    expect((await owner.get('/api/users/summary')).json()[1].deletion).not.toBeNull();
    expect((await owner.delete('/api/users/2/deletion')).statusCode).toBe(204);
    expect((await owner.get('/api/users/summary')).json()[1].deletion).toBeNull();
  });

  it('never deletes user 1 and keeps the routes owner-only', async () => {
    expect((await owner.post('/api/users/1/deletion')).statusCode).toBe(403);
    expect((await friend.post('/api/users/1/deletion')).statusCode).toBe(403);
    expect((await friend.post('/api/users/2/deletion')).statusCode).toBe(403);
    expect((await friend.delete('/api/users/2/deletion')).statusCode).toBe(403);
    expect((await owner.post('/api/users/99/deletion')).statusCode).toBe(404);
    expect((await owner.delete('/api/users/99/deletion')).statusCode).toBe(404);
  });
});

describe('account export', () => {
  it('includes the invitations, without codes, in the owner export only', async () => {
    const { code } = (await owner.post('/api/invites', { maxUses: 3 })).json();
    const mine = (await owner.get('/api/account/export/data')).json();
    expect(mine.invites).toHaveLength(1);
    expect(mine.invites[0]).toMatchObject({ maxUses: 3, status: 'valid', usedBy: [] });
    expect(JSON.stringify(mine)).not.toContain(code);
    expect((await friend.get('/api/account/export/data')).json().invites).toEqual([]);
  });
});
