import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '@metrack/domain';
import type { Authenticator } from '../src/auth/Authenticator.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { pathFetch } from './support/pathFetch.js';

const OWNER: User = { id: 1, name: 'Owner', email: null, role: 'owner' };
const FRIEND: User = { id: 2, name: 'Friend', email: null, role: 'normal' };

const byHeader: Authenticator = {
  userFor: async (headers) =>
    [OWNER, FRIEND].find((u) => u.id === Number(headers.get('x-test-user'))),
};

let api: TestApi;

beforeEach(async () => {
  api = await createTestApi(pathFetch({}).fetch, {
    scope: new AsyncUserScope(),
    authenticator: byHeader,
  });
  await new SqliteUserRepository(api.db).create({ name: FRIEND.name, email: null });
});

const as = (user: User) => ({
  get: (url: string) =>
    api.app.inject({ method: 'GET', url, headers: { 'x-test-user': String(user.id) } }),
  patch: (url: string, payload: object) =>
    api.app.inject({
      method: 'PATCH',
      url,
      payload,
      headers: { 'x-test-user': String(user.id) },
    }),
});

describe('the interface language setting', () => {
  it('starts unset', async () => {
    const own = (await as(FRIEND).get('/api/settings')).json();
    expect(own.settings.language).toBeNull();
  });

  it('lets each user choose their own language and clear it', async () => {
    const response = await as(FRIEND).patch('/api/settings', { language: 'en' });
    expect(response.statusCode).toBe(200);
    expect(response.json().language).toBe('en');
    expect((await as(FRIEND).get('/api/settings')).json().settings.language).toBe('en');
    expect((await as(OWNER).get('/api/settings')).json().settings.language).toBeNull();

    await as(FRIEND).patch('/api/settings', { language: null });
    expect((await as(FRIEND).get('/api/settings')).json().settings.language).toBeNull();
  });

  it('keeps the other settings when the language changes', async () => {
    api.db.prepare("INSERT INTO user_setting (user_id, ntfy_topic) VALUES (2, 'topic')").run();
    await as(FRIEND).patch('/api/settings', { language: 'es' });
    expect((await as(FRIEND).get('/api/settings')).json().settings).toMatchObject({
      ntfyTopic: 'topic',
      language: 'es',
    });
  });

  it('refuses unknown languages and other fields', async () => {
    expect((await as(FRIEND).patch('/api/settings', { language: 'fr' })).statusCode).toBe(400);
    expect((await as(FRIEND).patch('/api/settings', {})).statusCode).toBe(400);
    expect(
      (await as(FRIEND).patch('/api/settings', { language: 'es', ntfyTopic: 'x' })).statusCode,
    ).toBe(400);
  });

  it('is not part of what the owner edits for other users', async () => {
    const response = await as(OWNER).patch('/api/users/2/settings', { language: 'es' });
    expect(response.statusCode).toBe(400);
  });

  it('is listed with the other settings of every user', async () => {
    await as(FRIEND).patch('/api/settings', { language: 'es' });
    const users = (await as(OWNER).get('/api/users')).json();
    expect(users.find((entry: { user: User }) => entry.user.id === 2).settings.language).toBe('es');
  });
});
