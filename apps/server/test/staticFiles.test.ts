import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './support/buildTestApp.js';
import { DiskStaticFiles } from '../src/web/DiskStaticFiles.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { signedInAs } from './support/signedInAs.js';
import { OWNER_SCOPE } from './support/ownerScope.js';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'metrack-web-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<html>home</html>');
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)');
  return buildTestApp({
    appVersion: 'test',
    authenticator: signedInAs(),
    scope: OWNER_SCOPE,
    migrationRunner: new MigrationRunner(openTestDatabase(), migrations),
    web: new DiskStaticFiles(dir),
  });
}

describe('web app files', () => {
  it('serves files with validators and the index for every other address', async () => {
    const app = setup();
    const file = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(file.statusCode).toBe(200);
    expect(file.body).toBe('console.log(1)');
    expect(file.headers['content-type']).toContain('javascript');
    expect(file.headers['cache-control']).toBe('public, max-age=0');
    expect(file.headers.etag).toMatch(/^W\//);
    const root = await app.inject({ method: 'GET', url: '/' });
    expect(root.body).toBe('<html>home</html>');
    const deep = await app.inject({ method: 'GET', url: '/movies/3' });
    expect(deep.statusCode).toBe(200);
    expect(deep.body).toBe('<html>home</html>');
  });

  it('answers 304 to a matching validator', async () => {
    const app = setup();
    const first = await app.inject({ method: 'GET', url: '/assets/app.js' });
    const again = await app.inject({
      method: 'GET',
      url: '/assets/app.js',
      headers: { 'if-none-match': first.headers.etag ?? '' },
    });
    expect(again.statusCode).toBe(304);
  });

  it('serves byte ranges and refuses ones past the end', async () => {
    const app = setup();
    const part = await app.inject({
      method: 'GET',
      url: '/assets/app.js',
      headers: { range: 'bytes=0-6' },
    });
    expect(part.statusCode).toBe(206);
    expect(part.body).toBe('console');
    expect(part.headers['content-range']).toBe('bytes 0-6/14');
    const past = await app.inject({
      method: 'GET',
      url: '/assets/app.js',
      headers: { range: 'bytes=50-60' },
    });
    expect(past.statusCode).toBe(416);
  });

  it('keeps unknown API addresses and other methods as JSON 404s and never leaves the directory', async () => {
    const app = setup();
    const api = await app.inject({ method: 'GET', url: '/api/nothing' });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ error: 'Not found', code: 'not_found' });
    expect((await app.inject({ method: 'POST', url: '/movies/3' })).statusCode).toBe(404);
    const escape = await app.inject({ method: 'GET', url: '/..%2F..%2Fetc%2Fpasswd' });
    expect(escape.body).toBe('<html>home</html>');
  });
});
