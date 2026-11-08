import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/buildApp.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { LATEST_SCHEMA_VERSION } from './support/latestSchemaVersion.js';
import { migrations } from '../src/storage/migrations/index.js';
import { signedInAs } from './support/signedInAs.js';
import { OWNER_SCOPE } from './support/ownerScope.js';

describe('GET /api/health', () => {
  it('returns status and schema version after migrations', async () => {
    const runner = new MigrationRunner(new DatabaseSync(':memory:'), migrations);
    runner.run();
    const app = await buildApp({
      appVersion: 'test',
      authenticator: signedInAs(),
      scope: OWNER_SCOPE,
      migrationRunner: runner,
    });
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      appVersion: 'test',
      schemaVersion: LATEST_SCHEMA_VERSION,
    });
  });

  it('answers 503 with the same report when degraded', async () => {
    const runner = new MigrationRunner(new DatabaseSync(':memory:'), migrations);
    const app = await buildApp({
      appVersion: 'test',
      authenticator: signedInAs(),
      scope: OWNER_SCOPE,
      migrationRunner: runner,
    });
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'degraded', appVersion: 'test', schemaVersion: 0 });
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const runner = new MigrationRunner(new DatabaseSync(':memory:'), migrations);
    const app = await buildApp({
      appVersion: 'test',
      authenticator: signedInAs(),
      scope: OWNER_SCOPE,
      migrationRunner: runner,
    });
    const response = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(response.statusCode).toBe(404);
  });
});
