import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { classifyR2Action } from '../src/cloudflare-usage/classifyR2Action.js';
import { CloudflareUsageClient } from '../src/cloudflare-usage/CloudflareUsageClient.js';
import { CloudflareUsageMonitor } from '../src/cloudflare-usage/CloudflareUsageMonitor.js';
import { CloudflareUsageScheduler } from '../src/cloudflare-usage/CloudflareUsageScheduler.js';
import { CloudflareUsageError } from '../src/cloudflare-usage/CloudflareUsageError.js';
import { createCloudflareUsageScheduler } from '../src/cloudflare-usage/createCloudflareUsageScheduler.js';
import { loadCloudflareUsageConfig } from '../src/cloudflare-usage/loadCloudflareUsageConfig.js';
import type { UsageMetricKey } from '../src/cloudflare-usage/UsageMetricKey.js';
import type { UsageSample } from '../src/cloudflare-usage/UsageSample.js';
import { UsageStateStore } from '../src/cloudflare-usage/UsageStateStore.js';

const logger = { info: vi.fn(), error: vi.fn() };
const env = { CLOUDFLARE_USAGE_TOKEN: 'tok_secret', CLOUDFLARE_ACCOUNT_ID: 'abc123' };
const config = loadCloudflareUsageConfig(env)!;

function sample(used: Partial<Record<UsageMetricKey, number>>): UsageSample {
  const readings: UsageSample['readings'] = {};
  for (const [key, value] of Object.entries(used)) {
    readings[key as UsageMetricKey] = {
      used: value,
      consumers: [
        { name: 'big', value: value * 0.6 },
        { name: 'small', value: value * 0.4 },
      ],
    };
  }
  return { readings, unknownR2Actions: [] };
}

function harness(initial?: string) {
  const path = join(mkdtempSync(join(tmpdir(), 'cfu-')), 'state.json');
  if (initial) writeFileSync(path, initial);
  const clock = { now: new Date('2026-11-12T10:00:00Z') };
  const read = vi.fn<() => Promise<UsageSample>>();
  const notify = vi.fn<(title: string, message: string, options?: object) => Promise<boolean>>(
    async () => true,
  );
  const build = () =>
    new CloudflareUsageMonitor(
      { read },
      config,
      new UsageStateStore(path),
      { notify },
      logger,
      () => clock.now,
    );
  return { path, clock, read, notify, build };
}

function graphqlResponse(account: object, status = 200, errors?: object[]) {
  return new Response(JSON.stringify({ data: { viewer: { accounts: [account] } }, errors }), {
    status,
  });
}

describe('classifyR2Action', () => {
  it('maps actions to their billing class', () => {
    expect(classifyR2Action('PutObject')).toBe('A');
    expect(classifyR2Action('ListObjectsV2')).toBe('A');
    expect(classifyR2Action('GetObject')).toBe('B');
    expect(classifyR2Action('HeadObject')).toBe('B');
    expect(classifyR2Action('DeleteObjects')).toBe('free');
    expect(classifyR2Action('AbortMultipartUpload')).toBe('free');
    expect(classifyR2Action('SomethingNew')).toBe('unknown');
  });
});

describe('loadCloudflareUsageConfig', () => {
  it('is undefined without the token or the account id', () => {
    expect(loadCloudflareUsageConfig({ CLOUDFLARE_USAGE_TOKEN: 'x' })).toBeUndefined();
    expect(loadCloudflareUsageConfig({ CLOUDFLARE_ACCOUNT_ID: 'x' })).toBeUndefined();
  });

  it('uses the free-plan defaults and honours overrides', () => {
    expect(config.limits.workerRequests).toBe(100_000);
    expect(config.limits.d1Storage).toBe(500 * 1024 ** 2);
    expect(config.limits.r2Storage).toBe(10 * 1024 ** 3);
    expect([config.warnPercent, config.criticalPercent]).toEqual([70, 90]);
    const custom = loadCloudflareUsageConfig({
      ...env,
      CLOUDFLARE_LIMIT_D1_ROWS_READ: '10',
      CLOUDFLARE_USAGE_WARN_PERCENT: '50',
    })!;
    expect(custom.limits.d1RowsRead).toBe(10);
    expect(custom.warnPercent).toBe(50);
  });

  it('rejects bad values', () => {
    expect(() =>
      loadCloudflareUsageConfig({ ...env, CLOUDFLARE_LIMIT_D1_ROWS_READ: 'x' }),
    ).toThrow();
    expect(() => loadCloudflareUsageConfig({ ...env, CLOUDFLARE_ACCOUNT_ID: 'a"b' })).toThrow();
  });
});

describe('CloudflareUsageClient', () => {
  const account = {
    w: [
      { sum: { requests: 10 }, dimensions: { scriptName: 'metrack' } },
      { sum: { requests: 5 }, dimensions: { scriptName: 'other' } },
    ],
    d: [
      { sum: { rowsRead: 100, rowsWritten: 7 }, dimensions: { databaseId: '12345678-aaaa' } },
      { sum: { rowsRead: 50, rowsWritten: 1 }, dimensions: { databaseId: 'ffffffff-bbbb' } },
    ],
    r: [
      { sum: { requests: 4 }, dimensions: { actionType: 'PutObject', bucketName: 'imgs' } },
      { sum: { requests: 6 }, dimensions: { actionType: 'GetObject', bucketName: 'imgs' } },
      { sum: { requests: 9 }, dimensions: { actionType: 'DeleteObject', bucketName: 'imgs' } },
      { sum: { requests: 2 }, dimensions: { actionType: 'Mystery', bucketName: 'other' } },
      { sum: { requests: 3 }, dimensions: { actionType: 'ListBuckets', bucketName: '' } },
    ],
    s: [{ max: { payloadSize: 2048 }, dimensions: { bucketName: 'imgs' } }],
    ds: [
      { max: { databaseSizeBytes: 100 }, dimensions: { databaseId: 'a' } },
      { max: { databaseSizeBytes: 300 }, dimensions: { databaseId: 'a' } },
      { max: { databaseSizeBytes: 50 }, dimensions: { databaseId: 'b' } },
    ],
  };
  const now = () => new Date('2026-11-12T10:00:00Z');

  it('aggregates every metric, with a bearer token and the UTC periods in the query', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(graphqlResponse(account));
    const result = await new CloudflareUsageClient(
      'tok',
      'abc123',
      fetchFn as unknown as typeof fetch,
      now,
    ).read();
    expect(result.readings.workerRequests).toEqual({
      used: 15,
      consumers: [
        { name: 'metrack', value: 10 },
        { name: 'other', value: 5 },
      ],
    });
    expect(result.readings.d1RowsRead?.used).toBe(150);
    expect(result.readings.d1RowsRead?.consumers[0]).toEqual({ name: '12345678', value: 100 });
    expect(result.readings.d1RowsWritten?.used).toBe(8);
    expect(result.readings.r2ClassA).toEqual({
      used: 9,
      consumers: [
        { name: 'imgs', value: 4 },
        { name: 'account', value: 3 },
        { name: 'other', value: 2 },
      ],
    });
    expect(result.readings.r2ClassB?.used).toBe(6);
    expect(result.readings.r2Storage?.used).toBe(2048);
    expect(result.readings.d1Storage?.used).toBe(300);
    expect(result.readings.d1Storage?.consumers).toEqual([
      { name: 'a', value: 300 },
      { name: 'b', value: 50 },
    ]);
    expect(result.unknownR2Actions).toEqual(['Mystery']);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    const query = JSON.parse(init.body as string).query as string;
    expect(query).toContain('accountTag:"abc123"');
    expect(query).toContain('date_geq:"2026-11-12"');
    expect(query).toContain('date_geq:"2026-11-01"');
    expect(query).toContain('d1StorageAdaptiveGroups');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['HTTP status', () => new Response('', { status: 403 }), 'HTTP 403'],
    [
      'GraphQL errors',
      () => graphqlResponse({}, 200, [{ message: 'denied' }]),
      'GraphQL error: denied',
    ],
  ])('fails the main query on %s', async (_name, response, message) => {
    const fetchFn = vi.fn().mockResolvedValue(response());
    const client = new CloudflareUsageClient('tok', 'abc123', fetchFn as unknown as typeof fetch);
    await expect(client.read()).rejects.toThrow(message);
  });

  it('fails the main query on a network error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));
    const client = new CloudflareUsageClient('tok', 'abc123', fetchFn as unknown as typeof fetch);
    await expect(client.read()).rejects.toThrow('network error: offline');
  });
});

describe('CloudflareUsageMonitor', () => {
  it('stays quiet under the warning threshold', async () => {
    const h = harness();
    h.read.mockResolvedValue(sample({ workerRequests: 69_000 }));
    await h.build().tick();
    expect(h.notify).not.toHaveBeenCalled();
  });

  it('warns at 70 with default priority and critical at 90 with urgent priority', async () => {
    const h = harness();
    const monitor = h.build();
    h.read.mockResolvedValue(sample({ d1RowsWritten: 75_000 }));
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(1);
    const [title, body, options] = h.notify.mock.calls[0] as unknown as [string, string, object];
    expect(title).toBe('Cloudflare usage 75%: D1 rows written');
    expect(body).toContain('75,000 of 100,000 (75.0%) today (UTC 2026-11-12)');
    expect(body).toContain('- big: 45,000 (60%)');
    expect(options).toMatchObject({ priority: 'default' });
    h.read.mockResolvedValue(sample({ d1RowsWritten: 92_000 }));
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(2);
    expect(h.notify.mock.calls[1]).toMatchObject([
      'Cloudflare usage 92%: D1 rows written',
      expect.any(String),
      { priority: 'urgent' },
    ]);
  });

  it('sends only the critical alert when a tick jumps straight over 90', async () => {
    const h = harness();
    const monitor = h.build();
    h.read.mockResolvedValue(sample({ workerRequests: 95_000 }));
    await monitor.tick();
    h.read.mockResolvedValue(sample({ workerRequests: 96_000 }));
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.notify.mock.calls[0]).toMatchObject([
      expect.stringContaining('95%'),
      expect.anything(),
      { priority: 'urgent' },
    ]);
  });

  it('does not repeat an alert across ticks or a restart', async () => {
    const h = harness();
    h.read.mockResolvedValue(sample({ workerRequests: 80_000 }));
    await h.build().tick();
    await h.build().tick();
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(h.path, 'utf8')).sent).toEqual({
      'workerRequests|2026-11-12': 70,
    });
  });

  it('retries when ntfy did not accept the alert', async () => {
    const h = harness();
    h.notify.mockResolvedValueOnce(false);
    h.read.mockResolvedValue(sample({ workerRequests: 80_000 }));
    const monitor = h.build();
    await monitor.tick();
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(2);
  });

  it('alerts again in a new day and prunes past periods', async () => {
    const h = harness();
    const monitor = h.build();
    h.read.mockResolvedValue(sample({ workerRequests: 80_000, r2ClassA: 800_000 }));
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(2);
    h.clock.now = new Date('2026-11-13T00:05:00Z');
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(3);
    expect(Object.keys(JSON.parse(readFileSync(h.path, 'utf8')).sent).sort()).toEqual([
      'r2ClassA|2026-11',
      'workerRequests|2026-11-13',
    ]);
  });

  it('alerts again for monthly metrics in a new month', async () => {
    const h = harness();
    const monitor = h.build();
    h.read.mockResolvedValue(sample({ r2ClassB: 8_000_000 }));
    await monitor.tick();
    h.clock.now = new Date('2026-11-30T23:59:00Z');
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(1);
    h.clock.now = new Date('2026-12-01T00:01:00Z');
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(2);
  });

  it('alerts on a persistent storage size once a month, not every day', async () => {
    const h = harness();
    const monitor = h.build();
    h.read.mockResolvedValue(sample({ d1Storage: 430 * 1024 ** 2 }));
    await monitor.tick();
    expect(h.notify.mock.calls[0]?.[0]).toBe('Cloudflare usage 86%: Largest D1 database');
    expect(h.notify.mock.calls[0]?.[1]).toContain('- big: 258.00 MB\n');
    expect(h.notify.mock.calls[0]?.[1]).toMatch(/\n- small: [\d.]+ MB$/);
    h.clock.now = new Date('2026-11-13T10:00:00Z');
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(1);
    h.clock.now = new Date('2026-12-01T10:00:00Z');
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(2);
  });

  it('formats byte sizes', async () => {
    const h = harness();
    h.read.mockResolvedValue(sample({ r2Storage: 8 * 1024 ** 3 }));
    await h.build().tick();
    expect(h.notify.mock.calls[0]?.[1]).toContain('8.00 GB of 10.00 GB (80.0%)');
  });

  it('treats a corrupt state file as empty', async () => {
    const h = harness('{not json');
    h.read.mockResolvedValue(sample({ workerRequests: 80_000 }));
    await h.build().tick();
    expect(h.notify).toHaveBeenCalledTimes(1);
  });

  it('logs an unknown R2 action once', async () => {
    const h = harness();
    logger.info.mockClear();
    h.read.mockResolvedValue({ ...sample({}), unknownR2Actions: ['Mystery'] });
    const monitor = h.build();
    await monitor.tick();
    await monitor.tick();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('notifies the failure only after 3 in a row, once per day, without the token', async () => {
    const h = harness();
    const monitor = h.build();
    h.read.mockRejectedValue(new CloudflareUsageError('HTTP 403'));
    await monitor.tick();
    await monitor.tick();
    expect(h.notify).not.toHaveBeenCalled();
    await monitor.tick();
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.notify.mock.calls[0]?.[1]).toContain('HTTP 403');
    expect(JSON.stringify(h.notify.mock.calls)).not.toContain('tok_secret');
    h.clock.now = new Date('2026-11-13T10:00:00Z');
    await monitor.tick();
    expect(h.notify).toHaveBeenCalledTimes(2);
  });

  it('resets the failure counter on success', async () => {
    const h = harness();
    const monitor = h.build();
    h.read.mockRejectedValue(new Error('x'));
    await monitor.tick();
    await monitor.tick();
    h.read.mockResolvedValue(sample({}));
    await monitor.tick();
    h.read.mockRejectedValue(new Error('x'));
    await monitor.tick();
    await monitor.tick();
    expect(h.notify).not.toHaveBeenCalled();
  });
});

describe('CloudflareUsageScheduler', () => {
  it('skips a tick while the previous one is running and survives errors', async () => {
    let release!: () => void;
    const tick = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
      .mockRejectedValueOnce(new Error('boom'));
    const scheduler = new CloudflareUsageScheduler({ tick }, logger);
    const first = scheduler.tick();
    expect(await scheduler.tick()).toBe(false);
    release();
    await first;
    expect(await scheduler.tick()).toBe(true);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});

describe('createCloudflareUsageScheduler', () => {
  const ntfy = { url: 'http://ntfy.local', topic: 't' };

  it('is off without the env vars', () => {
    expect(createCloudflareUsageScheduler({}, ntfy, tmpdir(), logger)).toBeUndefined();
  });

  it('warns once and stays off without an owner ntfy target', () => {
    logger.info.mockClear();
    expect(createCloudflareUsageScheduler(env, undefined, tmpdir(), logger)).toBeUndefined();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('is on with the token, the account and ntfy', () => {
    expect(createCloudflareUsageScheduler(env, ntfy, tmpdir(), logger)).toBeInstanceOf(
      CloudflareUsageScheduler,
    );
  });

  it('is never referenced from the Worker entry', () => {
    for (const file of ['index.ts', 'createWorkerApp.ts', 'createWorkerHandler.ts']) {
      const source = readFileSync(join(__dirname, '../src/worker', file), 'utf8');
      expect(source).not.toMatch(/cloudflare-usage/i);
    }
  });
});
