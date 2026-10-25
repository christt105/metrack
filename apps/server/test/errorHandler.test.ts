import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/buildApp.js';
import { ApiError } from '../src/api/ApiError.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';

async function setup() {
  const runner = new MigrationRunner(new DatabaseSync(':memory:'), migrations);
  runner.run();
  const errors: string[] = [];
  const app = await buildApp({
    appVersion: 'test',
    migrationRunner: runner,
    logger: { info: () => {}, error: (message) => void errors.push(message) },
  });
  app.get('/api/boom', async () => {
    throw new Error('kaboom');
  });
  app.get('/api/missing', async () => {
    throw new ApiError(404, 'not_found', 'Nothing here');
  });
  return { app, errors };
}

describe('error handler', () => {
  it('logs unexpected failures with the request and hides them from the client', async () => {
    const { app, errors } = await setup();
    const response = await app.inject({ method: 'GET', url: '/api/boom' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'Internal server error', code: 'internal_error' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('GET /api/boom failed with 500');
    expect(errors[0]).toContain('kaboom');
  });

  it('does not log client errors', async () => {
    const { app, errors } = await setup();
    const response = await app.inject({ method: 'GET', url: '/api/missing' });
    expect(response.statusCode).toBe(404);
    expect(errors).toEqual([]);
  });
});
