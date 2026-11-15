import { describe, expect, it } from 'vitest';
import { GoogleSignIn } from '../src/auth/google/GoogleSignIn.js';
import { SessionCookieAuthenticator } from '../src/auth/SessionCookieAuthenticator.js';
import { SessionService } from '../src/auth/SessionService.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import { InviteService } from '../src/invites/InviteService.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { SqliteInviteRepository } from '../src/storage/sqlite/SqliteInviteRepository.js';
import { SqliteSessionRepository } from '../src/storage/sqlite/SqliteSessionRepository.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { buildTestApp } from './support/buildTestApp.js';
import { openTestDatabase } from './support/openTestDatabase.js';

const CLIENT_ID = 'client-id.apps.googleusercontent.com';
const NOW = new Date('2026-11-15T12:00:00Z');

type Claims = Record<string, unknown>;

function jwt(claims: Claims): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(claims)}.signature`;
}

async function setup() {
  const db = openTestDatabase();
  const users = new SqliteUserRepository(db);
  const invites = new SqliteInviteRepository(db);
  const service = new InviteService(invites, users, () => NOW);
  await users.create({ name: 'Existing', email: 'existing@example.com' });
  let claims: Claims = {};
  let nonce = '';
  const fetchFn: FetchFn = (async () =>
    Response.json({
      id_token: jwt({
        iss: 'https://accounts.google.com',
        aud: CLIENT_ID,
        exp: NOW.getTime() / 1000 + 3600,
        nonce,
        sub: 'new-sub',
        email: 'new@example.com',
        email_verified: true,
        name: 'New Friend',
        ...claims,
      }),
    })) as FetchFn;
  const google = new GoogleSignIn(
    { clientId: CLIENT_ID, clientSecret: 'secret' },
    users,
    invites,
    fetchFn,
    () => NOW,
  );
  const sessions = new SessionService(new SqliteSessionRepository(db), users, () => NOW);
  const app = buildTestApp({
    appVersion: 'test',
    migrationRunner: new MigrationRunner(db, migrations),
    authenticator: new SessionCookieAuthenticator(sessions),
    scope: new AsyncUserScope(),
    auth: { sessions, users, devLogin: false, google },
    invites: service,
  });

  async function signIn(code: string | undefined, override: Claims = {}) {
    claims = override;
    const query = code === undefined ? '' : `?invite=${code}`;
    const started = await app.request(`http://localhost/api/auth/google/start${query}`);
    const location = new URL(started.headers.get('location') ?? '');
    nonce = location.searchParams.get('nonce') ?? '';
    const cookie = (started.headers.getSetCookie()[0] ?? '').split(';')[0] ?? '';
    const response = await app.request(
      `http://localhost/api/auth/google/callback?code=abc&state=${location.searchParams.get('state')}`,
      { headers: { cookie } },
    );
    const session = response.headers
      .getSetCookie()
      .find((c) => c.startsWith('metrack_session=') && !c.startsWith('metrack_session=;'));
    return { location: response.headers.get('location'), session, cookie };
  }

  return { app, users, invites, service, signIn };
}

describe('Google sign-in with an invitation', () => {
  it('creates a normal user with the verified email and spends one use', async () => {
    const { signIn, users, service } = await setup();
    const { code } = await service.create({ maxUses: 1 });
    const result = await signIn(code);
    expect(result.location).toBe('/');
    expect(result.session).toBeDefined();
    const created = (await users.list()).find((user) => user.email === 'new@example.com');
    expect(created).toMatchObject({ name: 'New Friend', role: 'normal' });
    expect(await users.googleSubOf(created!.id)).toBe('new-sub');
    expect((await service.list())[0]).toMatchObject({ uses: 1, status: 'used_up' });
    expect(await users.isWelcomed(created!.id)).toBe(false);
  });

  it('carries the code in the flow cookie and asks Google for the profile scope', async () => {
    const { app, service } = await setup();
    const { code } = await service.create({ maxUses: 1 });
    const started = await app.request(`http://localhost/api/auth/google/start?invite=${code}`);
    expect(started.headers.getSetCookie()[0]).toContain(`.${code};`);
    expect(new URL(started.headers.get('location')!).searchParams.get('scope')).toBe(
      'openid email profile',
    );
  });

  it('ignores a code that is not made of URL-safe characters', async () => {
    const { app } = await setup();
    const started = await app.request('http://localhost/api/auth/google/start?invite=a.b;c');
    expect((started.headers.getSetCookie()[0] ?? '').split(';')[0]).toMatch(/\.\d+\.$/);
  });

  it('falls back to the email name when Google gives no name', async () => {
    const { signIn, users, service } = await setup();
    const { code } = await service.create({ maxUses: 1 });
    await signIn(code, { name: undefined });
    expect((await users.list()).map((user) => user.name)).toContain('new');
  });

  it('creates no user without an invitation', async () => {
    const { signIn, users } = await setup();
    const result = await signIn(undefined);
    expect(result.location).toBe('/login?error=google_no_account');
    expect(result.session).toBeUndefined();
    expect(await users.list()).toHaveLength(2);
  });

  it('creates no user when Google has not verified the email', async () => {
    const { signIn, users, service } = await setup();
    const { code } = await service.create({ maxUses: 1 });
    const result = await signIn(code, { email_verified: false });
    expect(result.location).toBe('/login?error=google_no_account');
    expect(await users.list()).toHaveLength(2);
    expect((await service.list())[0]?.uses).toBe(0);
  });

  it.each(['expired', 'revoked', 'used_up', 'unknown'])(
    'sends the browser back to the invitation page for a %s link and creates nothing',
    async (state) => {
      const { signIn, users, service, invites } = await setup();
      let code: string;
      if (state === 'expired') {
        const past = new InviteService(
          invites,
          users,
          () => new Date(NOW.getTime() - 9 * 86_400_000),
        );
        code = (await past.create({ maxUses: 1, expiresInDays: 1 })).code;
      } else {
        code = (await service.create({ maxUses: 1 })).code;
      }
      if (state === 'revoked') await service.revoke((await service.list())[0]!.id);
      if (state === 'used_up') await signIn(code, { sub: 'first', email: 'first@example.com' });
      if (state === 'unknown') code = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      const before = (await users.list()).length;
      const result = await signIn(code);
      expect(result.location).toBe(`/invite/${code}`);
      expect(result.session).toBeUndefined();
      expect(await users.list()).toHaveLength(before);
    },
  );

  it('signs in an existing user by email without spending a use', async () => {
    const { signIn, service, users } = await setup();
    const { code } = await service.create({ maxUses: 1 });
    const result = await signIn(code, { sub: 'existing-sub', email: 'existing@example.com' });
    expect(result.location).toBe('/');
    expect(result.session).toBeDefined();
    expect(await users.googleSubOf(2)).toBe('existing-sub');
    expect((await service.list())[0]?.uses).toBe(0);
    expect(await users.list()).toHaveLength(2);
  });

  it('signs in a returning user by sub without spending a use', async () => {
    const { signIn, service, users } = await setup();
    const first = await service.create({ maxUses: 2 });
    await signIn(first.code);
    const second = await service.create({ maxUses: 1 });
    const again = await signIn(second.code);
    expect(again.location).toBe('/');
    expect(again.session).toBeDefined();
    expect((await service.list()).map((invite) => invite.uses).sort()).toEqual([0, 1]);
    expect(await users.list()).toHaveLength(3);
  });

  it('admits a group: a multi-use link creates one user per Google account', async () => {
    const { signIn, service, users } = await setup();
    const { code } = await service.create({ maxUses: 2 });
    await signIn(code, { sub: 'a', email: 'a@example.com', name: 'a' });
    await signIn(code, { sub: 'b', email: 'b@example.com', name: 'b' });
    const third = await signIn(code, { sub: 'c', email: 'c@example.com', name: 'c' });
    expect(third.location).toBe(`/invite/${code}`);
    expect(await users.list()).toHaveLength(4);
    expect((await service.list())[0]?.usedBy.map((use) => use.userName)).toEqual(['a', 'b']);
  });
});
