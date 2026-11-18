import { beforeEach, describe, expect, it } from 'vitest';
import type { Authenticator } from '../src/auth/Authenticator.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { fakeFetch } from './support/fakeFetch.js';
import { readZip } from './support/readZip.js';

const DAY_MS = 24 * 3_600_000;

let api: TestApi;
let users: SqliteUserRepository;
let seriesId: number;

const byHeader: Authenticator = {
  userFor: async (headers) => users.get(Number(headers.get('x-test-user'))),
};

const count = (sql: string): number => Number(api.db.prepare(sql).get()?.n);

beforeEach(async () => {
  api = await createTestApi(fakeFetch({}).fetch, {
    scope: new AsyncUserScope(),
    authenticator: byHeader,
  });
  users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Nia', email: null });
  await users.create({ name: 'Ned', email: null });
  seriesId = Number(
    api.db.prepare("INSERT INTO series (tmdb_id, title) VALUES (1, 'Show')").run().lastInsertRowid,
  );
  const seasonId = Number(
    api.db
      .prepare('INSERT INTO season (series_id, number, episode_count) VALUES (?, 4, 3)')
      .run(seriesId).lastInsertRowid,
  );
  for (const user of [2, 3]) {
    api.db
      .prepare('INSERT INTO series_entry (user_id, series_id) VALUES (?, ?)')
      .run(user, seriesId);
    api.db
      .prepare('INSERT INTO season_entry (user_id, season_id, watched_count) VALUES (?, ?, 1)')
      .run(user, seasonId);
  }
  api.db
    .prepare('INSERT INTO series_episode_entry (user_id, series_id, watched) VALUES (2, ?, ?)')
    .run(
      seriesId,
      JSON.stringify({ '202': [{ startedAt: '2026-01-01', finishedAt: '2026-01-02' }] }),
    );
  api.db
    .prepare('INSERT INTO series_episode_entry (user_id, series_id, watched) VALUES (3, ?, ?)')
    .run(seriesId, JSON.stringify({ s4e1: [] }));
  api.db
    .prepare(
      "INSERT INTO season_episodes (season_id, episodes, source, fetched_at) VALUES (?, '[]', 'tmdb', 'now')",
    )
    .run(seasonId);
});

describe('the account export', () => {
  it('lists the episodes the user watched of each series, and no one else is in it', async () => {
    const response = await api.app.inject({
      method: 'GET',
      url: '/api/account/export',
      headers: { 'x-test-user': '2' },
    });
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(readZip(response.rawPayload).get('data.json')!.toString('utf8'));
    expect(data.episodeWatches).toEqual([
      {
        seriesId,
        watched: { '202': [{ startedAt: '2026-01-01', finishedAt: '2026-01-02' }] },
      },
    ]);
  });

  it('serves the same list in the data route the browser builds its ZIP from', async () => {
    const response = await api.app.inject({
      method: 'GET',
      url: '/api/account/export/data',
      headers: { 'x-test-user': '3' },
    });
    expect(response.json().episodeWatches).toMatchObject([{ seriesId, watched: { s4e1: [] } }]);
  });
});

describe('erasing an account', () => {
  it('removes the watches of the user and keeps the shared catalog and other users rows', async () => {
    await api.app.inject({
      method: 'POST',
      url: '/api/account/deletion',
      headers: { 'x-test-user': '3' },
      payload: { confirm: 'delete' },
    });
    api.clock.now = new Date(api.clock.now.getTime() + 8 * DAY_MS);
    expect(await api.deletion.eraseDue()).toEqual([3]);
    expect(count('SELECT COUNT(*) AS n FROM series_episode_entry WHERE user_id = 3')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM series_episode_entry WHERE user_id = 2')).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM season_episodes')).toBe(1);
  });

  it('removes the catalog and the watches of a series nobody has any more', async () => {
    for (const user of [2, 3]) {
      await api.app.inject({
        method: 'POST',
        url: '/api/account/deletion',
        headers: { 'x-test-user': String(user) },
        payload: { confirm: 'delete' },
      });
    }
    api.clock.now = new Date(api.clock.now.getTime() + 8 * DAY_MS);
    await api.deletion.eraseDue();
    expect(count('SELECT COUNT(*) AS n FROM series_episode_entry')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM season_episodes')).toBe(0);
  });
});
