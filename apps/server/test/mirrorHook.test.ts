import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './support/buildTestApp.js';
import { createImageStore } from '../src/images/createImageStore.js';
import { PublishQueue } from '../src/publish/PublishQueue.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { FakeScheduler } from './support/FakeScheduler.js';
import { ownerQueues } from './support/ownerQueues.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { png } from './support/sampleImages.js';
import { signedInAs } from './support/signedInAs.js';
import { OWNER_SCOPE } from './support/ownerScope.js';

describe('vault mirror hook', () => {
  it('refreshes the mirror after a successful write but not after reads or failures', async () => {
    const db = openTestDatabase();
    const store = createImageStore(
      db,
      join(mkdtempSync(join(tmpdir(), 'metrack-mirrorhook-')), 'i'),
    );
    const scheduler = new FakeScheduler();
    const queue = new PublishQueue(
      async () => 'done',
      { notify: async () => true },
      { info: () => {}, error: () => {} },
      scheduler,
    );
    const app = buildTestApp({
      appVersion: 'test',
      authenticator: signedInAs(),
      scope: OWNER_SCOPE,
      migrationRunner: new MigrationRunner(db, migrations),
      imageStore: store,
      mirrorQueues: ownerQueues(queue),
    });
    await app.inject({ method: 'GET', url: '/api/health' });
    await app.inject({ method: 'DELETE', url: '/api/images/nope' });
    expect(scheduler.pending()).toBe(0);
    const image = await store.add(png(1, 1), null);
    await app.inject({ method: 'DELETE', url: image.ref });
    expect(scheduler.pending()).toBe(1);
  });
});
