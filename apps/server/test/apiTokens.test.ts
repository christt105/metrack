import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { CreatedToken } from '@metrack/domain';
import { buildApp } from '../src/api/buildApp.js';
import { ApiTokenService } from '../src/auth/ApiTokenService.js';
import { SessionCookieAuthenticator } from '../src/auth/SessionCookieAuthenticator.js';
import { SessionService } from '../src/auth/SessionService.js';
import { PublishQueue } from '../src/publish/PublishQueue.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { SqliteApiTokenRepository } from '../src/storage/sqlite/SqliteApiTokenRepository.js';
import { SqliteSessionRepository } from '../src/storage/sqlite/SqliteSessionRepository.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { SqliteUserSettingsRepository } from '../src/storage/sqlite/SqliteUserSettingsRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { FakeScheduler } from './support/FakeScheduler.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { ownerQueues } from './support/ownerQueues.js';

const DAY_MS = 24 * 3_600_000;

async function setup() {
  const db = openTestDatabase();
  const users = new SqliteUserRepository(db);
  await users.create({ name: 'Friend', email: null });
  let now = new Date('2026-11-07T12:00:00Z');
  const clock = {
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
  const sessions = new SessionService(new SqliteSessionRepository(db), users, () => now);
  const tokens = new ApiTokenService(new SqliteApiTokenRepository(db), users, () => now);
  const queue = new PublishQueue(
    async () => 'published',
    { notify: async () => true },
    { info: () => {}, error: () => {} },
    new FakeScheduler(),
  );
  const app = await buildApp({
    appVersion: 'test',
    migrationRunner: new MigrationRunner(db, migrations),
    authenticator: new SessionCookieAuthenticator(sessions),
    scope: new AsyncUserScope(),
    auth: { sessions, users, devLogin: true },
    tokens,
    publishQueues: ownerQueues(queue),
    settings: { users, settings: new SqliteUserSettingsRepository(db) },
  });
  const cookieFor = async (userId: number): Promise<string> => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { userId },
    });
    return String(response.headers['set-cookie']).split(';')[0] ?? '';
  };
  const createToken = async (
    userId: number,
    scope: 'read' | 'write',
    expiresInDays: number | null = null,
  ): Promise<CreatedToken> => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: { cookie: await cookieFor(userId) },
      payload: { name: ` ${scope} token `, scope, expiresInDays },
    });
    expect(response.statusCode).toBe(201);
    return response.json<CreatedToken>();
  };
  const call = (method: 'GET' | 'POST' | 'DELETE', url: string, secret: string) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${secret}` } });
  return { db, app, clock, cookieFor, createToken, call };
}

describe('personal API tokens', () => {
  it('creates a token shown once and lists it without its secret', async () => {
    const { db, app, cookieFor, createToken } = await setup();
    const created = await createToken(1, 'read', 30);
    expect(created.secret).toMatch(/^mt_[A-Za-z0-9_-]{43}$/);
    expect(created.token).toEqual({
      id: 1,
      name: 'read token',
      scope: 'read',
      createdAt: '2026-11-07T12:00:00.000Z',
      expiresAt: '2026-12-07T12:00:00.000Z',
      lastUsedAt: null,
    });
    const list = await app.inject({
      method: 'GET',
      url: '/api/tokens',
      headers: { cookie: await cookieFor(1) },
    });
    expect(list.json()).toEqual([created.token]);
    expect(list.body).not.toContain(created.secret);
    const stored = db.prepare('SELECT secret_hash FROM api_token').get() as { secret_hash: string };
    expect(stored.secret_hash).toBe(createHash('sha256').update(created.secret).digest('hex'));
  });

  it('signs in as the token owner and records the last use at most once a minute', async () => {
    const { app, clock, cookieFor, createToken, call } = await setup();
    const { secret } = await createToken(2, 'read');
    const me = await call('GET', '/api/auth/me', secret);
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ id: 2, name: 'Friend' });

    const lastUsed = async () =>
      (
        await app.inject({
          method: 'GET',
          url: '/api/tokens',
          headers: { cookie: await cookieFor(2) },
        })
      ).json<{ lastUsedAt: string }[]>()[0]?.lastUsedAt;
    expect(await lastUsed()).toBe('2026-11-07T12:00:00.000Z');
    clock.advance(30_000);
    await call('GET', '/api/auth/me', secret);
    expect(await lastUsed()).toBe('2026-11-07T12:00:00.000Z');
    clock.advance(30_000);
    await call('GET', '/api/auth/me', secret);
    expect(await lastUsed()).toBe('2026-11-07T12:01:00.000Z');
  });

  it('lets a read token only read and a write token also change things', async () => {
    const { createToken, call } = await setup();
    const read = await createToken(1, 'read');
    const write = await createToken(1, 'write');
    const refused = await call('POST', '/api/publish', read.secret);
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toEqual({ error: 'This token can only read', code: 'read_only_token' });
    expect((await call('POST', '/api/publish', write.secret)).statusCode).toBe(202);
  });

  it('never reaches settings, token management or owner-only routes, even the owner’s', async () => {
    const { createToken, call } = await setup();
    const { secret } = await createToken(1, 'write');
    for (const [method, url] of [
      ['GET', '/api/settings'],
      ['GET', '/api/tokens'],
      ['POST', '/api/tokens'],
      ['DELETE', '/api/tokens/1'],
      ['GET', '/api/users'],
    ] as const) {
      const response = await call(method, url, secret);
      expect(response.statusCode, `${method} ${url}`).toBe(403);
      expect(response.json().code).toBe('session_required');
    }
  });

  it('refuses unknown, malformed, expired and revoked tokens, even next to a valid cookie', async () => {
    const { app, clock, cookieFor, createToken, call } = await setup();
    const cookie = await cookieFor(1);
    for (const authorization of ['Bearer mt_nope', 'Bearer', 'Basic dXNlcjpwYXNz', 'Bearer x']) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization, cookie },
      });
      expect(response.statusCode, authorization).toBe(401);
      expect(response.json()).toEqual({ error: 'Unknown or expired token', code: 'bad_token' });
    }

    const expiring = await createToken(1, 'read', 30);
    clock.advance(30 * DAY_MS - 1);
    expect((await call('GET', '/api/auth/me', expiring.secret)).statusCode).toBe(200);
    clock.advance(1);
    expect((await call('GET', '/api/auth/me', expiring.secret)).statusCode).toBe(401);

    const revoked = await createToken(1, 'read');
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/tokens/${revoked.token.id}`,
      headers: { cookie: await cookieFor(1) },
    });
    expect(response.statusCode).toBe(204);
    expect((await call('GET', '/api/auth/me', revoked.secret)).statusCode).toBe(401);
  });

  it('only lists and revokes the signed-in user’s own tokens', async () => {
    const { app, cookieFor, createToken, call } = await setup();
    const owners = await createToken(1, 'read');
    const friend = await cookieFor(2);
    const list = await app.inject({
      method: 'GET',
      url: '/api/tokens',
      headers: { cookie: friend },
    });
    expect(list.json()).toEqual([]);
    const revoke = await app.inject({
      method: 'DELETE',
      url: `/api/tokens/${owners.token.id}`,
      headers: { cookie: friend },
    });
    expect(revoke.statusCode).toBe(404);
    expect((await call('GET', '/api/auth/me', owners.secret)).statusCode).toBe(200);
  });

  it('validates the name, scope and lifetime', async () => {
    const { app, cookieFor } = await setup();
    const cookie = await cookieFor(1);
    for (const [payload, code] of [
      [{ name: '  ', scope: 'read', expiresInDays: null }, 'invalid_token_name'],
      [{ name: 'x'.repeat(61), scope: 'read', expiresInDays: null }, 'invalid_token_name'],
      [{ name: 'a', scope: 'read', expiresInDays: 7 }, 'invalid_token_lifetime'],
      [{ name: 'a', scope: 'admin', expiresInDays: null }, 'validation_error'],
      [{ name: 'a', scope: 'read' }, 'validation_error'],
    ] as const) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        headers: { cookie },
        payload,
      });
      expect(response.statusCode, JSON.stringify(payload)).toBe(400);
      expect(response.json().code).toBe(code);
    }
  });

  it('removes a user’s tokens with the user', async () => {
    const { db, createToken, call } = await setup();
    const { secret } = await createToken(2, 'read');
    db.prepare('DELETE FROM user WHERE id = 2').run();
    expect((await call('GET', '/api/auth/me', secret)).statusCode).toBe(401);
    expect(db.prepare('SELECT COUNT(*) AS n FROM api_token').get()).toEqual({ n: 0 });
  });
});
