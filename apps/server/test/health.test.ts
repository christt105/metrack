import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/buildApp.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';

describe('GET /api/health', () => {
  it('returns status and schema version after migrations', async () => {
    const runner = new MigrationRunner(new DatabaseSync(':memory:'), migrations);
    runner.run();
    const app = await buildApp({ appVersion: 'test', migrationRunner: runner });
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', appVersion: 'test', schemaVersion: 1 });
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const runner = new MigrationRunner(new DatabaseSync(':memory:'), migrations);
    const app = await buildApp({ appVersion: 'test', migrationRunner: runner });
    const response = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(response.statusCode).toBe(404);
  });
});
