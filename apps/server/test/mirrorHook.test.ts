import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/buildApp.js';
import { ImageStore } from '../src/images/ImageStore.js';
import { loadMirrorConfig } from '../src/mirror/loadMirrorConfig.js';
import { PublishQueue } from '../src/publish/PublishQueue.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { FakeScheduler } from './support/FakeScheduler.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { png } from './support/sampleImages.js';

describe('vault mirror hook', () => {
  it('refreshes the mirror after a successful write but not after reads or failures', async () => {
    const db = openTestDatabase();
    const store = new ImageStore(db, join(mkdtempSync(join(tmpdir(), 'metrack-mirrorhook-')), 'i'));
    const scheduler = new FakeScheduler();
    const queue = new PublishQueue(
      async () => 'done',
      { notify: async () => true },
      { info: () => {}, error: () => {} },
      scheduler,
    );
    const app = await buildApp({
      appVersion: 'test',
      migrationRunner: new MigrationRunner(db, migrations),
      imageStore: store,
      mirrorQueue: queue,
    });
    await app.inject({ method: 'GET', url: '/api/health' });
    await app.inject({ method: 'DELETE', url: '/api/images/nope' });
    expect(scheduler.pending()).toBe(0);
    const image = await store.add(png(1, 1), null);
    await app.inject({ method: 'DELETE', url: image.ref });
    expect(scheduler.pending()).toBe(1);
  });
});

describe('loadMirrorConfig', () => {
  it('is off without a folder and fills in the defaults', () => {
    expect(loadMirrorConfig({})).toBeUndefined();
    expect(loadMirrorConfig({ VAULT_MIRROR_DIR: '/vault/Media Tracker' })).toEqual({
      mirrorDir: '/vault/Media Tracker',
      linkPrefix: 'Media Tracker',
      webUrl: null,
    });
    expect(
      loadMirrorConfig({
        VAULT_MIRROR_DIR: '/v',
        VAULT_MIRROR_LINK_PREFIX: 'Media',
        VAULT_MIRROR_WEB_URL: 'http://metrack.lan',
      }),
    ).toEqual({ mirrorDir: '/v', linkPrefix: 'Media', webUrl: 'http://metrack.lan' });
  });
});
