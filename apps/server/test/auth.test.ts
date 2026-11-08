import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/buildApp.js';
import { readCookie } from '../src/auth/readCookie.js';
import { SessionCookieAuthenticator } from '../src/auth/SessionCookieAuthenticator.js';
import { SessionService } from '../src/auth/SessionService.js';
import { PublishQueue } from '../src/publish/PublishQueue.js';
import { ownerQueues } from './support/ownerQueues.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { SqliteSessionRepository } from '../src/storage/sqlite/SqliteSessionRepository.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { runUsersCommand } from '../src/users/runUsersCommand.js';
import { FakeScheduler } from './support/FakeScheduler.js';
import { openTestDatabase } from './support/openTestDatabase.js';

async function setup(devLogin = true) {
  const db = openTestDatabase();
  const users = new SqliteUserRepository(db);
  let now = new Date('2026-03-05T12:00:00Z');
  const clock = {
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
  const sessions = new SessionService(new SqliteSessionRepository(db), users, () => now);
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
    auth: { sessions, users, devLogin },
    publishQueues: ownerQueues(queue),
  });
  const signIn = async (userId: number) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { userId },
    });
    const header = String(response.headers['set-cookie']);
    return { response, header, cookie: header.split(';')[0] ?? '' };
  };
  return { db, app, users, clock, signIn };
}

describe('auth guard', () => {
  it('answers 401 on a private route without a session', async () => {
    const { app } = await setup();
    for (const [method, url] of [
      ['GET', '/api/auth/me'],
      ['POST', '/api/publish'],
    ] as const) {
      const response = await app.inject({ method, url });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Sign in first', code: 'unauthenticated' });
    }
  });

  it('rejects a made-up or tampered session cookie', async () => {
    const { app, signIn } = await setup();
    const { cookie } = await signIn(1);
    for (const value of ['metrack_session=nope', `${cookie}x`, 'metrack_session=']) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: value },
      });
      expect(response.statusCode).toBe(401);
    }
  });

  it('keeps health and the Jellyfin webhook public, and unknown routes a 404', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/sync/webhook' })).statusCode).toBe(501);
    expect((await app.inject({ method: 'GET', url: '/api/nope' })).statusCode).toBe(404);
  });
});

describe('dev login', () => {
  it('does not exist unless turned on', async () => {
    const { app } = await setup(false);
    expect((await app.inject({ method: 'GET', url: '/api/auth/dev-users' })).statusCode).toBe(404);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { userId: 1 },
    });
    expect(response.statusCode).toBe(404);
  });

  it('lists the users and signs in as one with an HttpOnly cookie', async () => {
    const { app, users, signIn } = await setup();
    await users.create({ name: 'Friend', email: 'friend@example.com' });
    const listed = await app.inject({ method: 'GET', url: '/api/auth/dev-users' });
    expect(listed.json()).toEqual([
      { id: 1, name: 'Owner', email: null, role: 'owner' },
      { id: 2, name: 'Friend', email: 'friend@example.com', role: 'normal' },
    ]);

    const { response, header, cookie } = await signIn(2);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: 2,
      name: 'Friend',
      email: 'friend@example.com',
      role: 'normal',
    });
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).not.toContain('Secure');

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.json()).toEqual({
      id: 2,
      name: 'Friend',
      email: 'friend@example.com',
      role: 'normal',
    });
  });

  it('answers 404 for a user that does not exist and 400 for a bad body', async () => {
    const { app, signIn } = await setup();
    expect((await signIn(99)).response.statusCode).toBe(404);
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { userId: 'one' },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe('sessions', () => {
  it('stores only a hash of the token', async () => {
    const { db, signIn } = await setup();
    const { cookie } = await signIn(1);
    const token = cookie.split('=')[1];
    const rows = db.prepare('SELECT id FROM session').all();
    expect(rows).toHaveLength(1);
    expect(String(rows[0]?.id)).not.toContain(token);
    expect(String(rows[0]?.id)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ends the session on logout', async () => {
    const { app, signIn } = await setup();
    const { cookie } = await signIn(1);
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    });
    expect(logout.statusCode).toBe(204);
    expect(String(logout.headers['set-cookie'])).toContain('Max-Age=0');
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  it('expires after 30 days and cleans up expired rows on the next sign-in', async () => {
    const { db, app, clock, signIn } = await setup();
    const { cookie } = await signIn(1);
    clock.advance(30 * 24 * 3_600_000 - 1);
    expect(
      (await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode,
    ).toBe(200);
    clock.advance(1);
    expect(
      (await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode,
    ).toBe(401);
    await signIn(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM session').get()?.n).toBe(1);
  });

  it('ends when the user is deleted', async () => {
    const { db, app, users, signIn } = await setup();
    const friend = await users.create({ name: 'Friend', email: null });
    const { cookie } = await signIn(friend.id);
    db.prepare('DELETE FROM user WHERE id = ?').run(friend.id);
    expect(db.prepare('SELECT COUNT(*) AS n FROM session').get()?.n).toBe(0);
    expect(
      (await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode,
    ).toBe(401);
  });
});

describe('users', () => {
  it('starts with user 1 as the owner of what was stored before users existed', async () => {
    const { users } = await setup();
    expect(await users.list()).toEqual([{ id: 1, name: 'Owner', email: null, role: 'owner' }]);
  });

  it('keeps emails unique regardless of case', async () => {
    const { users } = await setup();
    await users.create({ name: 'A', email: 'Friend@Example.com' });
    await expect(users.create({ name: 'B', email: 'friend@example.com' })).rejects.toThrow(
      'UNIQUE',
    );
  });

  it('are listed and added from the CLI', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'metrack-users-'));
    expect(await runUsersCommand({ dataDir })).toBe('1  Owner  owner  [no jobs]');
    expect(
      await runUsersCommand({ dataDir, add: { name: 'Friend', email: 'friend@example.com' } }),
    ).toBe('Created 2  Friend  <friend@example.com>  normal');
    expect(await runUsersCommand({ dataDir })).toBe(
      '1  Owner  owner  [no jobs]\n2  Friend  <friend@example.com>  normal  [no jobs]',
    );
  });

  it('get a role from the CLI, except user 1 who is always the owner', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'metrack-users-'));
    await runUsersCommand({ dataDir, add: { name: 'Friend', email: null } });
    expect(
      await runUsersCommand({ dataDir, set: { userId: 2, changes: {}, role: 'trusted' } }),
    ).toContain('2  Friend  trusted');
    expect(await runUsersCommand({ dataDir })).toContain('2  Friend  trusted  [no jobs]');
    await expect(
      runUsersCommand({ dataDir, set: { userId: 2, changes: {}, role: 'owner' } }),
    ).rejects.toThrow('Role must be one of trusted, normal');
    await expect(
      runUsersCommand({ dataDir, set: { userId: 1, changes: {}, role: 'normal' } }),
    ).rejects.toThrow('User 1 is always the owner');
  });

  it('get their job settings from the CLI, where an empty value clears one', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'metrack-users-'));
    await runUsersCommand({ dataDir, add: { name: 'Friend', email: null } });
    const shown = await runUsersCommand({
      dataDir,
      set: { userId: 2, changes: { jellyfinUser: 'haku', mirrorDir: '/vault/Friend' } },
    });
    expect(shown).toContain('jellyfinUser: haku');
    expect(shown).toContain('ntfyTopic: -');
    expect(await runUsersCommand({ dataDir })).toBe(
      '1  Owner  owner  [no jobs]\n2  Friend  normal  [sync, mirror]',
    );
    await runUsersCommand({ dataDir, set: { userId: 2, changes: { mirrorDir: '' } } });
    expect(await runUsersCommand({ dataDir, set: { userId: 2, changes: {} } })).toContain(
      'mirrorDir: -',
    );
    await expect(
      runUsersCommand({ dataDir, set: { userId: 9, changes: { ntfyTopic: 't' } } }),
    ).rejects.toThrow('There is no user 9');
    await expect(
      runUsersCommand({ dataDir, set: { userId: 2, changes: { ntfyTopic: 'two words' } } }),
    ).rejects.toThrow('Invalid settings: ntfyTopic');
  });

  it('get a public page handle from the CLI, and keep it when job settings change', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'metrack-users-'));
    await runUsersCommand({ dataDir, add: { name: 'Friend', email: null } });
    const shown = await runUsersCommand({
      dataDir,
      set: { userId: 2, changes: {}, handle: 'Friend', publicPage: true },
    });
    expect(shown).toContain('publicPage: on, handle: friend');
    await runUsersCommand({ dataDir, set: { userId: 2, changes: { ntfyTopic: 't' } } });
    expect(await runUsersCommand({ dataDir, set: { userId: 2, changes: {} } })).toContain(
      'publicPage: on, handle: friend',
    );
    await expect(
      runUsersCommand({ dataDir, set: { userId: 1, changes: {}, handle: 'friend' } }),
    ).rejects.toThrow('taken');
    await expect(
      runUsersCommand({ dataDir, set: { userId: 1, changes: {}, handle: 'admin' } }),
    ).rejects.toThrow('Invalid handle');
    await expect(
      runUsersCommand({ dataDir, set: { userId: 1, changes: {}, publicPage: true } }),
    ).rejects.toThrow('needs a handle');
    expect(
      await runUsersCommand({
        dataDir,
        set: { userId: 2, changes: {}, handle: '', publicPage: false },
      }),
    ).toContain('publicPage: off, handle: -');
  });
});

describe('readCookie', () => {
  it('finds one cookie among several and ignores look-alike names', () => {
    expect(readCookie('a=1; metrack_session=abc; b=2', 'metrack_session')).toBe('abc');
    expect(readCookie('xmetrack_session=abc', 'metrack_session')).toBeUndefined();
    expect(readCookie('metrack_session', 'metrack_session')).toBeUndefined();
    expect(readCookie(undefined, 'metrack_session')).toBeUndefined();
  });
});
