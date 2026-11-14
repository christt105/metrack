import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CloudImageCleanup } from '../src/cloudcleanup/CloudImageCleanup.js';
import { CloudImageCleanupJob } from '../src/cloudcleanup/CloudImageCleanupJob.js';
import { createCloudImageCleanup } from '../src/cloudcleanup/createCloudImageCleanup.js';
import { runCloudImageCleanupCommand } from '../src/cloudcleanup/runCloudImageCleanupCommand.js';
import type { CloudImageCleanupConfig } from '../src/cloudcleanup/CloudImageCleanupConfig.js';
import { OWNER_ID } from '../src/users/OWNER_ID.js';
import { createD1Backend } from './support/d1Backend.js';
import type { D1Harness } from './support/D1Harness.js';
import { FakeCloudflare } from './support/FakeCloudflare.js';
import { RecordingNotifier } from './support/RecordingNotifier.js';

const backend = createD1Backend();
afterAll(() => backend.dispose());

const OLD = '2026-01-01T00:00:00.000Z';
const config: CloudImageCleanupConfig = {
  d1: { accountId: 'acct', databaseId: 'db1', token: 'tok' },
  r2: {
    bucket: 'images',
    accessKeyId: 'k',
    secretAccessKey: 's',
    endpoint: 'https://acct.r2.cloudflarestorage.com',
  },
  maxFraction: 0.5,
  maxCount: 100,
};

let harness: D1Harness;
let cloud: FakeCloudflare;
let errors: string[];
const logger = { info: () => {}, error: (m: string) => errors.push(m) };

const hash = (n: number): string => n.toString(16).padStart(64, '0');

async function addImage(n: number, createdAt = OLD): Promise<void> {
  await harness.run(
    `INSERT INTO image (hash, extension, mime_type, width, height, byte_size, source_url, created_at)
     VALUES (?, 'webp', 'image/webp', 1, 1, 1000, NULL, ?)`,
    hash(n),
    createdAt,
  );
  cloud.objects.set(`${hash(n)}.webp`, new Uint8Array(3));
}

const remaining = async (): Promise<string[]> =>
  (await harness.query('SELECT hash FROM image ORDER BY hash')).map((r) => String(r.hash));

beforeEach(async () => {
  harness = (await backend.open()) as D1Harness;
  cloud = new FakeCloudflare(harness.db);
  errors = [];
});

async function seed(): Promise<void> {
  for (const n of [1, 2, 3, 4, 5]) await addImage(n);
  await harness.run(
    'INSERT INTO movie (title, cover) VALUES (?, ?)',
    'A',
    `/api/images/${hash(1)}`,
  );
  await harness.run(
    'INSERT INTO movie (title, cover) VALUES (?, ?)',
    'B',
    `/api/images/${hash(2)}`,
  );
  await harness.run(
    'INSERT INTO movie (title, cover) VALUES (?, ?)',
    'C',
    `/api/images/${hash(3)}`,
  );
  await addImage(6, new Date().toISOString());
}

describe('createCloudImageCleanup', () => {
  it('counts the orphans and deletes nothing without apply', async () => {
    await seed();
    const text = await runCloudImageCleanupCommand(config, false, logger, cloud.fetch);
    expect(text).toContain('2 of 6 image(s) orphaned (0.0 MiB), dry run, nothing deleted');
    expect(await remaining()).toHaveLength(6);
    expect(cloud.objects.size).toBe(6);
    expect(cloud.requests.some((r) => r.method === 'DELETE')).toBe(false);
  });

  it('deletes the rows and objects of the orphans older than the grace period, and only those', async () => {
    await seed();
    const result = await createCloudImageCleanup(config, logger, cloud.fetch).run(true);
    expect(result).toMatchObject({
      total: 6,
      orphans: 2,
      removed: 2,
      failed: 0,
      orphanBytes: 2000,
    });
    expect(await remaining()).toEqual([hash(1), hash(2), hash(3), hash(6)]);
    expect([...cloud.objects.keys()].sort()).toEqual([1, 2, 3, 6].map((n) => `${hash(n)}.webp`));
    const batches = cloud.requests.filter((r) => r.body?.batch);
    expect(batches.length).toBeGreaterThan(2);
    expect(JSON.stringify(cloud.requests.map((r) => r.body ?? '')).length).toBeLessThan(100_000);
  });

  it('refuses to delete when too large a share of the images is orphaned', async () => {
    await seed();
    const cleanup = createCloudImageCleanup({ ...config, maxFraction: 0.3 }, logger, cloud.fetch);
    await expect(cleanup.run(true)).rejects.toThrow(/2 of 6 images, more than 30%/);
    expect(await remaining()).toHaveLength(6);
    expect(cloud.requests.some((r) => r.method === 'DELETE')).toBe(false);
  });

  it('refuses to delete more orphans than the count limit but still reports them in a dry run', async () => {
    await seed();
    const cleanup = createCloudImageCleanup({ ...config, maxCount: 1 }, logger, cloud.fetch);
    await expect(cleanup.run(true)).rejects.toThrow(/2 orphan images, more than the limit of 1/);
    expect((await cleanup.run(false)).orphans).toBe(2);
    expect(await remaining()).toHaveLength(6);
  });

  it('logs an object that cannot be deleted after its row is gone and goes on', async () => {
    await seed();
    cloud.failDelete = (key) => key === `${hash(4)}.webp`;
    const result = await createCloudImageCleanup(config, logger, cloud.fetch).run(true);
    expect(result).toMatchObject({ removed: 1, failed: 1 });
    expect(await remaining()).toEqual([hash(1), hash(2), hash(3), hash(6)]);
    expect(cloud.objects.has(`${hash(4)}.webp`)).toBe(true);
    expect(errors[0]).toContain(`deleting ${hash(4)} failed`);
  });

  it('does nothing on an empty library', async () => {
    const result = await createCloudImageCleanup(config, logger, cloud.fetch).run(true);
    expect(result).toMatchObject({ total: 0, orphans: 0, removed: 0 });
  });

  it('keeps an image whose owner claimed it recently', async () => {
    await addImage(1);
    await harness.run(
      'INSERT INTO image_owner (hash, user_id, created_at) VALUES (?, ?, ?)',
      hash(1),
      OWNER_ID,
      new Date().toISOString(),
    );
    const result = await createCloudImageCleanup(config, logger, cloud.fetch).run(true);
    expect(result.orphans).toBe(0);
  });
});

describe('CloudImageCleanupJob', () => {
  it('alerts after three failures in a row and again when it recovers', async () => {
    const notifier = new RecordingNotifier();
    let down = true;
    const cleanup = {
      run: async () => {
        if (down) throw new Error('D1 is down');
        return {
          applied: true,
          total: 0,
          orphans: 0,
          orphanBytes: 0,
          removed: 0,
          failed: 0,
          durationMs: 0,
        };
      },
    } as unknown as CloudImageCleanup;
    const job = new CloudImageCleanupJob(cleanup, notifier, logger);
    for (let i = 0; i < 3; i += 1) await expect(job.run()).rejects.toThrow('D1 is down');
    expect(job.consecutiveFailures).toBe(3);
    expect(notifier.sent.map((n) => n.title)).toEqual([
      'metrack connector: the cloud image cleanup failed',
    ]);
    down = false;
    await job.run();
    expect(notifier.sent[1]!.title).toBe('metrack connector: the cloud image cleanup recovered');
  });

  it('counts a run with undeletable objects as a failure', async () => {
    await seed();
    cloud.failDelete = () => true;
    const notifier = new RecordingNotifier();
    const job = new CloudImageCleanupJob(
      createCloudImageCleanup(config, logger, cloud.fetch),
      notifier,
      logger,
    );
    await expect(job.run()).rejects.toThrow('2 image(s) could not be deleted');
  });
});
