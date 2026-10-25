import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/buildApp.js';
import { ImageStore } from '../src/images/ImageStore.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { png } from './support/sampleImages.js';

async function setup() {
  const db = openTestDatabase();
  const store = new ImageStore(db, join(mkdtempSync(join(tmpdir(), 'metrack-routes-')), 'images'));
  const app = await buildApp({
    appVersion: 'test',
    migrationRunner: new MigrationRunner(db, migrations),
    imageStore: store,
  });
  return { app, store };
}

describe('image routes', () => {
  it('serves a stored image with its content type', async () => {
    const { app, store } = await setup();
    const image = await store.add(png(2, 3), null);
    const response = await app.inject({ method: 'GET', url: image.ref });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.rawPayload.equals(png(2, 3))).toBe(true);
  });

  it('answers 404 for unknown or malformed hashes', async () => {
    const { app } = await setup();
    expect(
      (await app.inject({ method: 'GET', url: `/api/images/${'a'.repeat(64)}` })).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/images/..%2Fsecret' })).statusCode).toBe(
      404,
    );
    expect((await app.inject({ method: 'DELETE', url: '/api/images/nope' })).statusCode).toBe(404);
  });

  it('deletes one image and cleans orphans', async () => {
    const { app, store } = await setup();
    const a = await store.add(png(1, 1, 1), null);
    const b = await store.add(png(1, 1, 2), null);
    expect((await app.inject({ method: 'DELETE', url: a.ref })).statusCode).toBe(204);
    expect(store.get(a.hash)).toBeUndefined();
    const cleanup = await app.inject({ method: 'POST', url: '/api/images/cleanup' });
    expect(cleanup.json()).toEqual({ removed: [b.hash] });
  });
});
