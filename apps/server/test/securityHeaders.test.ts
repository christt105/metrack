import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './support/buildTestApp.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { signedInAs } from './support/signedInAs.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import { HSTS_HEADER, SECURITY_HEADERS, withSecurityHeaders } from '../src/api/securityHeaders.js';
import { serveAsset } from '../src/worker/serveAsset.js';
import type { WorkerEnv } from '../src/worker/WorkerEnv.js';

function setup() {
  const runner = new MigrationRunner(new DatabaseSync(':memory:'), migrations);
  runner.run();
  const app = buildTestApp({
    appVersion: 'test',
    authenticator: signedInAs(),
    scope: OWNER_SCOPE,
    migrationRunner: runner,
  });
  app.get('/api/boom', async () => {
    throw new Error('kaboom');
  });
  app.get('/api/custom', () => new Response('x', { headers: { 'X-Frame-Options': 'SAMEORIGIN' } }));
  return app;
}

function expectFixedHeaders(response: Response): void {
  for (const [name, value] of SECURITY_HEADERS) expect(response.headers.get(name)).toBe(value);
}

describe('security headers middleware', () => {
  it('adds the fixed headers to a normal route, without HSTS over HTTP', async () => {
    const response = await setup().request('http://localhost/api/health');
    expectFixedHeaders(response);
    expect(response.headers.get(HSTS_HEADER[0])).toBeNull();
  });

  it('adds HSTS over HTTPS', async () => {
    const response = await setup().request('https://example.org/api/health');
    expect(response.headers.get(HSTS_HEADER[0])).toBe(HSTS_HEADER[1]);
  });

  it('adds HSTS behind a proxy that forwards https', async () => {
    const response = await setup().request('http://localhost/api/health', {
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(response.headers.get(HSTS_HEADER[0])).toBe(HSTS_HEADER[1]);
  });

  it('adds the headers to a 404', async () => {
    const response = await setup().request('http://localhost/api/does-not-exist');
    expect(response.status).toBe(404);
    expectFixedHeaders(response);
  });

  it('adds the headers to an error response', async () => {
    const response = await setup().request('http://localhost/api/boom');
    expect(response.status).toBe(500);
    expectFixedHeaders(response);
  });

  it('keeps a header the route set itself', async () => {
    const response = await setup().request('http://localhost/api/custom');
    expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});

describe('withSecurityHeaders', () => {
  it('copies a response whose headers are immutable', () => {
    const original = Response.redirect('https://example.org/', 302);
    const result = withSecurityHeaders(original, true);
    expectFixedHeaders(result);
    expect(result.headers.get(HSTS_HEADER[0])).toBe(HSTS_HEADER[1]);
    expect(result.status).toBe(302);
  });
});

describe('serveAsset headers', () => {
  function assets(response: Response): WorkerEnv {
    return { ASSETS: { fetch: async () => response } } as unknown as WorkerEnv;
  }
  const request = new Request('https://example.org/assets/app.js');

  it('adds the headers to a served asset', async () => {
    const asset = new Response('console.log(1)', {
      headers: { 'content-type': 'text/javascript' },
    });
    const response = await serveAsset(request, assets(asset));
    expect(response.status).toBe(200);
    expectFixedHeaders(response);
    expect(response.headers.get(HSTS_HEADER[0])).toBe(HSTS_HEADER[1]);
  });

  it('adds the headers to the JSON 404', async () => {
    const page = new Response('<html>', { headers: { 'content-type': 'text/html' } });
    const response = await serveAsset(request, assets(page));
    expect(response.status).toBe(404);
    expectFixedHeaders(response);
  });
});

describe('_headers file', () => {
  it('lists the same headers as the server', () => {
    const file = readFileSync(new URL('../../web/public/_headers', import.meta.url), 'utf8');
    const listed = file
      .split('\n')
      .filter((line) => /^\s+\S/.test(line))
      .map((line) => line.trim());
    const expected = [...SECURITY_HEADERS, HSTS_HEADER].map(([name, value]) => `${name}: ${value}`);
    expect(listed.sort()).toEqual(expected.sort());
  });
});
