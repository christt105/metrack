import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './support/buildTestApp.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { signedInAs } from './support/signedInAs.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import { APP_CONTENT_SECURITY_POLICY } from '../src/api/appContentSecurityPolicy.js';
import { PUBLIC_CONTENT_SECURITY_POLICY } from '../src/api/publicContentSecurityPolicy.js';
import { CONTENT_SECURITY_POLICY_HEADER } from '../src/api/contentSecurityPolicyHeader.js';
import { contentSecurityPolicyFor } from '../src/api/contentSecurityPolicyFor.js';
import { HSTS_HEADER, SECURITY_HEADERS, withSecurityHeaders } from '../src/api/securityHeaders.js';
import { serveAsset } from '../src/worker/serveAsset.js';
import { serveApp } from '../src/worker/serveApp.js';
import { createWorkerHandler } from '../src/worker/createWorkerHandler.js';
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
    const result = withSecurityHeaders(original, true, '/');
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
  it('lists the same headers as the server and no content security policy', () => {
    const file = readFileSync(new URL('../../web/public/_headers', import.meta.url), 'utf8');
    const listed = file
      .split('\n')
      .filter((line) => /^\s+\S/.test(line))
      .map((line) => line.trim());
    const expected = [...SECURITY_HEADERS, HSTS_HEADER].map(([name, value]) => `${name}: ${value}`);
    expect(listed.sort()).toEqual(expected.sort());
  });
});

describe('wrangler run_worker_first', () => {
  it('sends every page to the Worker and excludes exactly the static files of the web app', () => {
    const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
    const block = /"run_worker_first": \[([^\]]*)\]/.exec(config)![1]!;
    const patterns = [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    expect(patterns).toContain('/*');
    const excluded = patterns.filter((p) => p!.startsWith('!')).map((p) => p!.slice(1));
    const files = readdirSync(new URL('../../web/public', import.meta.url))
      .filter((name) => name !== '_headers')
      .map((name) => `/${name}`);
    expect(excluded.sort()).toEqual(files.sort());
  });
});

describe('content security policy', () => {
  it.each([
    ['/', APP_CONTENT_SECURITY_POLICY],
    ['/index.html', APP_CONTENT_SECURITY_POLICY],
    ['/api/health', APP_CONTENT_SECURITY_POLICY],
    ['/assets/x', APP_CONTENT_SECURITY_POLICY],
    ['/users', APP_CONTENT_SECURITY_POLICY],
    ['/privacy', PUBLIC_CONTENT_SECURITY_POLICY],
    ['/privacy/', PUBLIC_CONTENT_SECURITY_POLICY],
    ['/u/x/', PUBLIC_CONTENT_SECURITY_POLICY],
    ['/u/assets/x.js', PUBLIC_CONTENT_SECURITY_POLICY],
    ['/u', PUBLIC_CONTENT_SECURITY_POLICY],
  ])('picks the policy for %s', (path, policy) => {
    expect(contentSecurityPolicyFor(path)).toBe(policy);
  });

  it('enforces the policy with the Content-Security-Policy header only', async () => {
    const response = await setup().request('http://localhost/api/health');
    expect(CONTENT_SECURITY_POLICY_HEADER).toBe('Content-Security-Policy');
    expect(response.headers.get('Content-Security-Policy')).toBe(APP_CONTENT_SECURITY_POLICY);
    expect(response.headers.has('Content-Security-Policy-Report-Only')).toBe(false);
  });

  it('gives a route under /u the public policy', async () => {
    const response = await setup().request('http://localhost/u/nobody/');
    expect(
      response.headers.get(CONTENT_SECURITY_POLICY_HEADER)!.replace(/ 'nonce-[^']+'/, ''),
    ).toBe(PUBLIC_CONTENT_SECURITY_POLICY);
  });

  it('keeps a policy the route set itself, without adding a second value', async () => {
    const response = withSecurityHeaders(
      new Response('x', { headers: { [CONTENT_SECURITY_POLICY_HEADER]: "default-src 'none'" } }),
      false,
      '/',
    );
    expect(response.headers.get(CONTENT_SECURITY_POLICY_HEADER)).toBe("default-src 'none'");
  });

  it('adds the policy to a Worker asset by its path', async () => {
    const env = {
      ASSETS: { fetch: async () => new Response('x', { headers: { 'content-type': 'text/css' } }) },
    } as unknown as WorkerEnv;
    const response = await serveAsset(new Request('https://example.org/assets/app.css'), env);
    expect(response.headers.get(CONTENT_SECURITY_POLICY_HEADER)).toBe(APP_CONTENT_SECURITY_POLICY);
  });

  const nonceOf = (policy: string): string => /script-src[^;]*'nonce-([^']+)'/.exec(policy)![1]!;
  const policyOf = (response: Response): string =>
    response.headers.get(CONTENT_SECURITY_POLICY_HEADER)!;
  const html = (): Response => new Response('<html>', { headers: { 'content-type': 'text/html' } });

  it.each(['/', '/settings', '/u/x/', '/privacy'])(
    'puts a fresh nonce in the script-src of an HTML response at %s',
    (path) => {
      const first = policyOf(withSecurityHeaders(html(), true, path));
      const second = policyOf(withSecurityHeaders(html(), true, path));
      expect(nonceOf(first)).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      expect(nonceOf(first)).not.toBe(nonceOf(second));
    },
  );

  it('overwrites a policy an HTML response already carries', () => {
    const response = new Response('<html>', {
      headers: {
        'content-type': 'text/html',
        [CONTENT_SECURITY_POLICY_HEADER]: "default-src 'none'",
      },
    });
    expect(policyOf(withSecurityHeaders(response, true, '/'))).toContain("'nonce-");
  });

  it('keeps the nonce out of style-src and gives both style-src the hash', () => {
    const publicPolicy = policyOf(withSecurityHeaders(html(), true, '/u/x/'));
    expect(publicPolicy).toContain(
      "style-src 'self' 'unsafe-hashes' 'sha256-Ia8f7Xd1GU9rNhtqyt5pM4QjRB9pqCkMhfAkkeE4+l4=' https://giscus.app;",
    );
    expect(publicPolicy).toContain("script-src 'self' https://giscus.app 'nonce-");
    expect(publicPolicy).not.toMatch(/style-src[^;]*nonce/);
    const appPolicy = policyOf(withSecurityHeaders(html(), true, '/'));
    expect(appPolicy).toContain(
      "style-src 'self' 'unsafe-hashes' 'sha256-Ia8f7Xd1GU9rNhtqyt5pM4QjRB9pqCkMhfAkkeE4+l4='",
    );
    expect(appPolicy).not.toMatch(/style-src[^;]*nonce/);
  });

  it('leaves the policy of a non-HTML response without a nonce', () => {
    const json = new Response('{}', { headers: { 'content-type': 'application/json' } });
    expect(policyOf(withSecurityHeaders(json, true, '/api/x'))).toBe(APP_CONTENT_SECURITY_POLICY);
  });

  it('gives a 304 a policy with a nonce', () => {
    const response = withSecurityHeaders(new Response(null, { status: 304 }), true, '/u/x/');
    expect(nonceOf(policyOf(response))).toBeTruthy();
  });

  it('serves the app shell through the Worker with a nonce, whatever the binding sent', async () => {
    const page = (): Response =>
      new Response('<html>app</html>', {
        headers: { 'content-type': 'text/html', [CONTENT_SECURITY_POLICY_HEADER]: 'default-src *' },
      });
    const env = { ASSETS: { fetch: async () => page() } } as unknown as WorkerEnv;
    const handler = createWorkerHandler();
    for (const path of ['/', '/settings', '/movies/1']) {
      const response = await handler.fetch(
        new Request(`https://example.org${path}`),
        env,
        {} as never,
      );
      expect(await response.text()).toBe('<html>app</html>');
      expect(nonceOf(policyOf(response))).toBeTruthy();
      expectFixedHeaders(response);
    }
    const direct = await serveApp(new Request('https://example.org/login'), env);
    expect(direct.headers.get(CONTENT_SECURITY_POLICY_HEADER)).toContain("'nonce-");
  });

  it('keeps both policies free of inline code, the public one being the app one plus giscus', () => {
    expect(PUBLIC_CONTENT_SECURITY_POLICY).not.toContain('unsafe-inline');
    expect(APP_CONTENT_SECURITY_POLICY).not.toContain('unsafe-inline');
    expect(APP_CONTENT_SECURITY_POLICY).not.toContain('giscus');
    expect(PUBLIC_CONTENT_SECURITY_POLICY.replaceAll(' https://giscus.app', '')).toBe(
      APP_CONTENT_SECURITY_POLICY.replace("frame-src 'none'", 'frame-src'),
    );
    expect(PUBLIC_CONTENT_SECURITY_POLICY).toContain('frame-src https://giscus.app;');
  });
});
