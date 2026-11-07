import { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '@metrack/domain';
import type { Authenticator } from '../src/auth/Authenticator.js';
import { buildApp } from '../src/api/buildApp.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { SqliteUserSettingsRepository } from '../src/storage/sqlite/SqliteUserSettingsRepository.js';
import { NO_SETTINGS } from '../src/users/NO_SETTINGS.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { OWNER_ID } from '../src/users/OWNER_ID.js';

const OWNER: User = { id: OWNER_ID, name: 'Owner', email: null };
const FRIEND: User = { id: 2, name: 'Friend', email: null };

const byHeader: Authenticator = {
  userFor: async (headers) => [OWNER, FRIEND].find((u) => u.id === Number(headers['x-test-user'])),
};

let settings: SqliteUserSettingsRepository;
let app: FastifyInstance;

beforeEach(async () => {
  const db = new DatabaseSync(':memory:');
  const runner = new MigrationRunner(db, migrations);
  runner.run();
  const users = new SqliteUserRepository(db);
  await users.create({ name: FRIEND.name, email: null });
  settings = new SqliteUserSettingsRepository(db);
  await settings.save(OWNER_ID, {
    ...NO_SETTINGS,
    jellyfinUser: 'admin',
    mirrorDir: '/vault/Media Tracker',
  });
  app = await buildApp({
    appVersion: 'test',
    authenticator: byHeader,
    scope: new AsyncUserScope(),
    migrationRunner: runner,
    settings: { users, settings },
  });
});

function request(user: User, method: 'GET' | 'PATCH', url: string, payload?: object) {
  return app.inject({ method, url, payload, headers: { 'x-test-user': String(user.id) } });
}

describe('settings routes', () => {
  it('show each user their own settings', async () => {
    const own = await request(OWNER, 'GET', '/api/settings');
    expect(own.json()).toEqual({
      owner: true,
      settings: { ...NO_SETTINGS, jellyfinUser: 'admin', mirrorDir: '/vault/Media Tracker' },
    });
    const friend = await request(FRIEND, 'GET', '/api/settings');
    expect(friend.json()).toEqual({ owner: false, settings: NO_SETTINGS });
  });

  it('list everyone only to the owner', async () => {
    expect((await request(FRIEND, 'GET', '/api/users')).statusCode).toBe(403);
    const list = await request(OWNER, 'GET', '/api/users');
    expect(list.json()).toEqual([
      {
        user: OWNER,
        settings: { ...NO_SETTINGS, jellyfinUser: 'admin', mirrorDir: '/vault/Media Tracker' },
      },
      { user: FRIEND, settings: NO_SETTINGS },
    ]);
  });

  it('let only the owner change them', async () => {
    const own = await request(FRIEND, 'PATCH', '/api/users/2/settings', { ntfyTopic: 'friend' });
    expect(own.statusCode).toBe(403);
    expect(
      (await request(FRIEND, 'PATCH', '/api/users/1/settings', { jellyfinUser: 'x' })).statusCode,
    ).toBe(403);
    expect(await settings.get(2)).toBeUndefined();

    const changed = await request(OWNER, 'PATCH', '/api/users/2/settings', {
      jellyfinUser: ' haku ',
      ntfyTopic: 'friend',
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toEqual({ ...NO_SETTINGS, jellyfinUser: 'haku', ntfyTopic: 'friend' });
    expect(await settings.get(2)).toEqual(changed.json());

    const cleared = await request(OWNER, 'PATCH', '/api/users/2/settings', { ntfyTopic: null });
    expect(cleared.json()).toEqual({ ...NO_SETTINGS, jellyfinUser: 'haku' });
  });

  it('refuse invalid values, the vault folder and unknown users', async () => {
    const invalid = await request(OWNER, 'PATCH', '/api/users/1/settings', {
      jellyfinUser: 'other',
      publishBaseUrl: 'javascript:alert(1)',
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({
      code: 'invalid_settings',
      details: { publishBaseUrl: expect.any(String) },
    });
    expect((await settings.get(1))?.jellyfinUser).toBe('admin');

    const folder = await request(OWNER, 'PATCH', '/api/users/1/settings', { mirrorDir: '/data' });
    expect(folder.statusCode).toBe(400);
    expect((await settings.get(1))?.mirrorDir).toBe('/vault/Media Tracker');

    const missing = await request(OWNER, 'PATCH', '/api/users/9/settings', { ntfyTopic: 'x' });
    expect(missing.statusCode).toBe(404);
  });
});
