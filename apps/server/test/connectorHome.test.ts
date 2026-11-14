import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CloudClient } from '../src/connector/CloudClient.js';
import { ConnectorQueue } from '../src/connector/ConnectorQueue.js';
import { ConnectorStateStore } from '../src/connector/ConnectorStateStore.js';
import { FullPass } from '../src/connector/FullPass.js';
import { WebhookSecret } from '../src/api/WebhookSecret.js';
import { createConnectorApp } from '../src/connector/createConnectorApp.js';
import { findConnectorUser } from '../src/connector/findConnectorUser.js';
import { loadConnectorConfig } from '../src/connector/loadConnectorConfig.js';
import { FakeScheduler } from './support/FakeScheduler.js';
import { RecordingNotifier } from './support/RecordingNotifier.js';

const logger = { info: () => {}, error: () => {} };

function pass(users: () => Promise<Response>) {
  const dir = mkdtempSync(join(tmpdir(), 'connector-'));
  const store = new ConnectorStateStore(dir);
  const queueScheduler = new FakeScheduler();
  const scheduler = new FakeScheduler();
  const notifier = new RecordingNotifier();
  const queue = new ConnectorQueue(async () => 'ok', store, notifier, logger, queueScheduler, {
    debounceMs: 1000,
  });
  const cloud = new CloudClient('http://cloud.test', 'token', (async () =>
    users()) as unknown as typeof fetch);
  const fullPass = new FullPass(cloud, queue, store, notifier, logger, scheduler, 6 * 3_600_000);
  return { fullPass, queueScheduler, scheduler, notifier, store };
}

describe('FullPass', () => {
  it('queues every user with a Jellyfin account, remembers them and runs again after the interval', async () => {
    const { fullPass, queueScheduler, scheduler, store } = pass(async () =>
      Response.json([
        { id: 1, name: 'a', jellyfinUser: 'a' },
        { id: 2, name: 'b', jellyfinUser: 'b' },
      ]),
    );
    await fullPass.run();
    expect(queueScheduler.pending()).toBe(2);
    expect(store.read().users).toEqual([1, 2]);
    expect(fullPass.knownUsers()).toEqual([1, 2]);
    expect(scheduler.delays).toEqual([6 * 3_600_000]);
  });

  it('retries after 1, 5, 15 and 60 minutes when the cloud is unreachable and tells the notifier after three', async () => {
    const { fullPass, scheduler, notifier } = pass(async () => {
      throw new TypeError('fetch failed');
    });
    await fullPass.run();
    for (let i = 0; i < 4; i += 1) await scheduler.fire();
    expect(scheduler.delays).toEqual([60_000, 300_000, 900_000, 3_600_000, 3_600_000]);
    expect(notifier.sent).toHaveLength(1);
  });
});

describe('FullPass.queueUsersForWebhook', () => {
  it('queues a user linked in the cloud after the last full pass', async () => {
    let users = [{ id: 1, name: 'a', jellyfinUser: 'a' }];
    const { fullPass, queueScheduler, store } = pass(async () => Response.json(users));
    await fullPass.run();
    expect(queueScheduler.pending()).toBe(1);
    users = [...users, { id: 2, name: 'b', jellyfinUser: 'b' }];
    expect(await fullPass.queueUsersForWebhook()).toBe(2);
    expect(queueScheduler.pending()).toBe(2);
    expect(store.read().users).toEqual([1, 2]);
  });

  it('queues the known users when the cloud cannot be reached', async () => {
    let down = false;
    const { fullPass, queueScheduler } = pass(async () => {
      if (down) throw new TypeError('fetch failed');
      return Response.json([
        { id: 1, name: 'a', jellyfinUser: 'a' },
        { id: 2, name: 'b', jellyfinUser: 'b' },
      ]);
    });
    await fullPass.run();
    await queueScheduler.fire();
    await queueScheduler.fire();
    expect(queueScheduler.pending()).toBe(0);
    down = true;
    const response = await createConnectorApp({
      onWebhook: () => fullPass.queueUsersForWebhook(),
    }).request('/webhook', { method: 'POST' });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: 'queued', users: 2 });
    expect(queueScheduler.pending()).toBe(2);
  });

  it('fails when the cloud cannot be reached and no user is known', async () => {
    const { fullPass } = pass(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(fullPass.queueUsersForWebhook()).rejects.toThrow('fetch failed');
  });
});

describe('connector webhook', () => {
  const app = (queued: number[] = []) =>
    createConnectorApp({
      secret: new WebhookSecret('a-long-enough-secret'),
      onWebhook: async () => (queued.push(1), 2),
    });

  it('answers 401 without the secret and queues nothing', async () => {
    const queued: number[] = [];
    const response = await app(queued).request('/webhook', { method: 'POST' });
    expect(response.status).toBe(401);
    expect(queued).toEqual([]);
  });

  it('answers 202 with the secret in the header or the token parameter', async () => {
    const queued: number[] = [];
    const viaHeader = await app(queued).request('/webhook', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'a-long-enough-secret' },
    });
    expect(viaHeader.status).toBe(202);
    expect(await viaHeader.json()).toEqual({ status: 'queued', users: 2 });
    const viaQuery = await app(queued).request('/webhook?token=a-long-enough-secret', {
      method: 'POST',
    });
    expect(viaQuery.status).toBe(202);
    expect(queued).toHaveLength(2);
  });

  it('answers the health check', async () => {
    expect((await app().request('/api/health')).status).toBe(200);
  });
});

describe('findConnectorUser', () => {
  const users = [
    { id: 1, name: 'Christian', jellyfinUser: 'haku' },
    { id: 2, name: 'Ana', jellyfinUser: 'mama' },
  ];

  it('matches by id, name or Jellyfin account, ignoring case', () => {
    expect(findConnectorUser(users, '2')?.id).toBe(2);
    expect(findConnectorUser(users, 'christian')?.id).toBe(1);
    expect(findConnectorUser(users, 'MAMA')?.id).toBe(2);
    expect(findConnectorUser(users, 'nobody')).toBeUndefined();
  });
});

describe('loadConnectorConfig', () => {
  const env = {
    METRACK_URL: 'https://metrack.example.com/',
    METRACK_CONNECTOR_TOKEN: 'mt_x',
    JELLYFIN_URL: 'http://jf',
    JELLYFIN_TOKEN: 't',
    JELLYSTAT_DB_HOST: 'db',
    JELLYSTAT_DB_PASSWORD: 'p',
  };

  it('lists what is missing', () => {
    expect(loadConnectorConfig({}, '/data').missing).toEqual([
      'METRACK_URL',
      'METRACK_CONNECTOR_TOKEN',
      'JELLYFIN_URL',
      'JELLYFIN_TOKEN',
      'JELLYSTAT_DB_HOST',
      'JELLYSTAT_DB_PASSWORD',
    ]);
  });

  it('reads the address without a trailing slash, the data dir and the pass interval', () => {
    const { config } = loadConnectorConfig({ ...env, CONNECTOR_PASS_HOURS: '2' }, '/data');
    expect(config).toMatchObject({
      cloudUrl: 'https://metrack.example.com',
      token: 'mt_x',
      dataDir: '/data',
      passIntervalMs: 7_200_000,
    });
    expect(
      loadConnectorConfig({ ...env, CONNECTOR_DATA_DIR: '/own' }, '/data').config?.dataDir,
    ).toBe('/own');
    expect(loadConnectorConfig(env, '/data').config?.passIntervalMs).toBe(6 * 3_600_000);
  });

  it('leaves release alerts off unless CONNECTOR_RELEASE_ALERTS is true', () => {
    expect(loadConnectorConfig(env, '/data').config?.releaseAlerts).toBeUndefined();
    expect(
      loadConnectorConfig({ ...env, CONNECTOR_RELEASE_ALERTS: 'yes' }, '/data').config
        ?.releaseAlerts,
    ).toBeUndefined();
  });

  it('reads the release alert settings with their defaults', () => {
    expect(
      loadConnectorConfig({ ...env, CONNECTOR_RELEASE_ALERTS: 'true' }, '/data').config
        ?.releaseAlerts,
    ).toEqual({
      ntfyUrl: 'https://ntfy.sh',
      notifyFromHour: 9,
      tickMs: 300_000,
      dailyLimit: 200,
    });
    expect(
      loadConnectorConfig(
        {
          ...env,
          CONNECTOR_RELEASE_ALERTS: 'true',
          CONNECTOR_RELEASE_NTFY_URL: 'https://ntfy.example.com',
          CONNECTOR_RELEASE_FROM_HOUR: '10',
          CONNECTOR_RELEASE_TICK_MINUTES: '2',
          CONNECTOR_RELEASE_DAILY_LIMIT: '50',
        },
        '/data',
      ).config?.releaseAlerts,
    ).toEqual({
      ntfyUrl: 'https://ntfy.example.com',
      notifyFromHour: 10,
      tickMs: 120_000,
      dailyLimit: 50,
    });
  });

  it('refuses bad release alert settings', () => {
    const on = { ...env, CONNECTOR_RELEASE_ALERTS: 'true' };
    for (const bad of [
      { CONNECTOR_RELEASE_FROM_HOUR: '24' },
      { CONNECTOR_RELEASE_TICK_MINUTES: '0' },
      { CONNECTOR_RELEASE_DAILY_LIMIT: 'many' },
      { CONNECTOR_RELEASE_NTFY_URL: 'nope' },
    ]) {
      expect(() => loadConnectorConfig({ ...on, ...bad }, '/d')).toThrow('CONNECTOR_RELEASE_');
    }
  });

  it('refuses a bad address or interval', () => {
    expect(() => loadConnectorConfig({ ...env, METRACK_URL: 'nope' }, '/d')).toThrow('METRACK_URL');
    expect(() => loadConnectorConfig({ ...env, CONNECTOR_PASS_HOURS: '0' }, '/d')).toThrow(
      'CONNECTOR_PASS_HOURS',
    );
  });
});

describe('ConnectorStateStore', () => {
  it('reads empty when there is no file or it is unreadable, and round-trips what it writes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'connector-'));
    const store = new ConnectorStateStore(dir);
    const empty = { users: [], pending: {}, alertsSent: { day: '', count: 0 } };
    expect(store.read()).toEqual(empty);
    const saved = {
      users: [1],
      pending: { '1': { dueAt: 5, failures: 2 } },
      alertsSent: { day: '2026-11-14', count: 3 },
    };
    store.write(saved);
    expect(store.read()).toEqual(saved);
  });
});
