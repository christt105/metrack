import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/buildApp.js';
import { ImageStore } from '../src/images/ImageStore.js';
import { PublishQueue } from '../src/publish/PublishQueue.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { FakeScheduler } from './support/FakeScheduler.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { png } from './support/sampleImages.js';

async function setup() {
  const db = openTestDatabase();
  const store = new ImageStore(db, join(mkdtempSync(join(tmpdir(), 'metrack-pubroutes-')), 'i'));
  const scheduler = new FakeScheduler();
  const queue = new PublishQueue(
    async () => 'published',
    { notify: async () => {} },
    { info: () => {}, error: () => {} },
    scheduler,
  );
  const app = await buildApp({
    appVersion: 'test',
    migrationRunner: new MigrationRunner(db, migrations),
    imageStore: store,
    publishQueue: queue,
  });
  return { app, store, scheduler };
}

describe('publish routes', () => {
  it('queues a publish on request', async () => {
    const { app, scheduler } = await setup();
    const response = await app.inject({ method: 'POST', url: '/api/publish' });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ status: 'queued', failures: 0 });
    expect(scheduler.pending()).toBe(1);
  });

  it('queues a publish after a successful write but not after reads or failures', async () => {
    const { app, store, scheduler } = await setup();
    await app.inject({ method: 'GET', url: '/api/health' });
    await app.inject({ method: 'DELETE', url: '/api/images/nope' });
    expect(scheduler.pending()).toBe(0);
    const image = await store.add(png(1, 1), null);
    await app.inject({ method: 'DELETE', url: image.ref });
    expect(scheduler.pending()).toBe(1);
  });
});
