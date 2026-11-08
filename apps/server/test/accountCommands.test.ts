import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { FetchFn } from '../src/http/FetchFn.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { runUsersCommand } from '../src/users/runUsersCommand.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { fakeFetch } from './support/fakeFetch.js';
import { readZip } from './support/readZip.js';

const DAY_MS = 24 * 3_600_000;

let api: TestApi;
let posted: { url: string; body: { topic: string; title: string; message: string } }[];

const recordingFetch: FetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
  posted.push({ url: String(url), body: JSON.parse(String(init?.body)) });
  return new Response('{}');
}) as FetchFn;

beforeEach(async () => {
  posted = [];
  api = await createTestApi(fakeFetch({}).fetch);
  const users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Tess', email: null });
  await users.create({ name: 'Nia', email: null });
  api.db.exec("INSERT INTO user_setting (user_id, ntfy_topic) VALUES (3, 'nia-topic')");
});

const ntfy = { url: 'https://ntfy.test' };

describe('metrack users delete', () => {
  it('schedules a deletion with the grace period and tells the user through their ntfy topic', async () => {
    const output = await runUsersCommand({
      dataDir: api.dir,
      delete: { userId: 3, cancel: false },
      ntfy,
      fetchFn: recordingFetch,
    });
    expect(output).toContain('User 3 will be deleted on');
    const requested = api.db
      .prepare('SELECT deletion_requested_at AS at FROM user WHERE id = 3')
      .get() as { at: string };
    const deleteAt = new Date(Date.parse(requested.at) + 7 * DAY_MS).toISOString();
    expect(output).toContain(deleteAt);
    expect(posted).toHaveLength(1);
    expect(posted[0]!.body.topic).toBe('nia-topic');
    expect(posted[0]!.body.message).toContain(deleteAt.slice(0, 10));
    expect(await runUsersCommand({ dataDir: api.dir })).toContain(`deletion on ${deleteAt}`);
  });

  it('does not tell the user twice and keeps the original date', async () => {
    const command = {
      dataDir: api.dir,
      delete: { userId: 3, cancel: false },
      ntfy,
      fetchFn: recordingFetch,
    };
    await runUsersCommand(command);
    const first = api.db.prepare('SELECT deletion_requested_at AS at FROM user WHERE id = 3').get();
    await runUsersCommand(command);
    expect(posted).toHaveLength(1);
    expect(
      api.db.prepare('SELECT deletion_requested_at AS at FROM user WHERE id = 3').get(),
    ).toEqual(first);
  });

  it('cancels the request and says so', async () => {
    await runUsersCommand({
      dataDir: api.dir,
      delete: { userId: 3, cancel: false },
      ntfy,
      fetchFn: recordingFetch,
    });
    const output = await runUsersCommand({
      dataDir: api.dir,
      delete: { userId: 3, cancel: true },
      ntfy,
      fetchFn: recordingFetch,
    });
    expect(output).toBe('Cancelled the deletion of user 3');
    expect(posted).toHaveLength(2);
    expect(posted[1]!.body.title).toContain('cancelled');
    expect(await runUsersCommand({ dataDir: api.dir, delete: { userId: 3, cancel: true } })).toBe(
      'User 3 has no deletion waiting',
    );
  });

  it('schedules without a message when the user has no topic or no server is configured', async () => {
    await runUsersCommand({
      dataDir: api.dir,
      delete: { userId: 2, cancel: false },
      ntfy,
      fetchFn: recordingFetch,
    });
    await runUsersCommand({
      dataDir: api.dir,
      delete: { userId: 3, cancel: false },
      fetchFn: recordingFetch,
    });
    expect(posted).toEqual([]);
    expect(
      api.db
        .prepare('SELECT COUNT(*) AS n FROM user WHERE deletion_requested_at IS NOT NULL')
        .get(),
    ).toEqual({ n: 2 });
  });

  it('refuses the owner and unknown users', async () => {
    await expect(
      runUsersCommand({ dataDir: api.dir, delete: { userId: 1, cancel: false } }),
    ).rejects.toThrow('The owner account cannot be deleted');
    await expect(
      runUsersCommand({ dataDir: api.dir, delete: { userId: 99, cancel: false } }),
    ).rejects.toThrow('That user does not exist');
  });

  it('is erased by the server job once the grace period passes', async () => {
    await runUsersCommand({ dataDir: api.dir, delete: { userId: 3, cancel: false } });
    expect(await api.deletion.eraseDue()).toEqual([]);
    api.clock.now = new Date(Date.now() + 8 * DAY_MS);
    expect(await api.deletion.eraseDue()).toEqual([3]);
  });
});

describe('metrack users export', () => {
  it('writes the ZIP of the user to a file', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'metrack-export-')), 'nia.zip');
    const output = await runUsersCommand({ dataDir: api.dir, exportTo: { userId: 3, file } });
    expect(output).toContain(`to ${file}`);
    const data = JSON.parse(readZip(readFileSync(file)).get('data.json')!.toString('utf8'));
    expect(data.user.name).toBe('Nia');
    writeFileSync(file, '');
  });

  it('fails for an unknown user', async () => {
    await expect(
      runUsersCommand({
        dataDir: api.dir,
        exportTo: { userId: 99, file: join(tmpdir(), 'x.zip') },
      }),
    ).rejects.toThrow('There is no user 99');
  });
});
