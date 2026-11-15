import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './support/buildTestApp.js';
import { GoogleSignIn } from '../src/auth/google/GoogleSignIn.js';
import { SessionCookieAuthenticator } from '../src/auth/SessionCookieAuthenticator.js';
import { SessionService } from '../src/auth/SessionService.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { SqliteInviteRepository } from '../src/storage/sqlite/SqliteInviteRepository.js';
import { SqliteSessionRepository } from '../src/storage/sqlite/SqliteSessionRepository.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { openTestDatabase } from './support/openTestDatabase.js';

const CLIENT_ID = 'client-id.apps.googleusercontent.com';
const NOW = new Date('2026-11-14T12:00:00Z');
const CALLBACK = 'http://localhost/api/auth/google/callback';

type Claims = Record<string, unknown>;

function jwt(claims: Claims): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(claims)}.signature`;
}

async function setup() {
  const db = openTestDatabase();
  const users = new SqliteUserRepository(db);
  await users.create({ name: 'Friend', email: 'Friend@Example.com' });
  const tokenRequests: URLSearchParams[] = [];
  let answer: () => Response = () => new Response('{}', { status: 500 });
  const fetchFn: FetchFn = (async (_url: unknown, init?: RequestInit) => {
    tokenRequests.push(new URLSearchParams(String(init?.body)));
    return answer();
  }) as FetchFn;
  const google = new GoogleSignIn(
    { clientId: CLIENT_ID, clientSecret: 'secret' },
    users,
    new SqliteInviteRepository(db),
    fetchFn,
    () => NOW,
  );
  const sessions = new SessionService(new SqliteSessionRepository(db), users, () => NOW);
  const app = buildTestApp({
    appVersion: 'test',
    migrationRunner: new MigrationRunner(db, migrations),
    authenticator: new SessionCookieAuthenticator(sessions),
    scope: new AsyncUserScope(),
    auth: { sessions, users, devLogin: false, google },
  });

  async function begin() {
    const response = await app.request(`http://localhost/api/auth/google/start`);
    const location = new URL(response.headers.get('location') ?? '');
    const cookie = (response.headers.getSetCookie()[0] ?? '').split(';')[0] ?? '';
    return { response, location, cookie };
  }

  async function callback(
    claims: Claims,
    options: { cookie?: string; state?: string; tokenResponse?: Response } = {},
  ) {
    const started = await begin();
    const nonce = started.location.searchParams.get('nonce');
    answer = () =>
      options.tokenResponse ??
      Response.json({
        id_token: jwt({
          iss: 'https://accounts.google.com',
          aud: CLIENT_ID,
          exp: NOW.getTime() / 1000 + 3600,
          nonce,
          sub: 'sub-1',
          email: 'friend@example.com',
          email_verified: true,
          ...claims,
        }),
      });
    const state = options.state ?? started.location.searchParams.get('state');
    const response = await app.request(
      `http://localhost/api/auth/google/callback?code=abc&state=${state}`,
      { headers: { cookie: options.cookie ?? started.cookie } },
    );
    const cookies = response.headers.getSetCookie();
    return {
      location: response.headers.get('location'),
      status: response.status,
      cookies,
      session: cookies.find(
        (c) => c.startsWith('metrack_session=') && !c.startsWith('metrack_session=;'),
      ),
      started,
    };
  }

  return { app, users, db, tokenRequests, begin, callback };
}

describe('Google sign-in', () => {
  it('redirects to Google with PKCE, a state, a nonce and a short-lived flow cookie', async () => {
    const { begin } = await setup();
    const { response, location, cookie } = await begin();
    expect(response.status).toBe(302);
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    const query = location.searchParams;
    expect(query.get('client_id')).toBe(CLIENT_ID);
    expect(query.get('redirect_uri')).toBe(CALLBACK);
    expect(query.get('scope')).toBe('openid email profile');
    expect(query.get('response_type')).toBe('code');
    expect(query.get('code_challenge_method')).toBe('S256');
    expect(query.get('prompt')).toBe('select_account');
    expect(query.get('state')).toBeTruthy();
    expect(query.get('nonce')).toBeTruthy();
    const setCookie = response.headers.getSetCookie()[0] ?? '';
    expect(setCookie).toContain('Max-Age=600');
    expect(setCookie).toContain('Path=/api/auth/google');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toContain('Secure');
    expect(cookie).toContain(query.get('state'));
  });

  it('marks the flow cookie Secure over https', async () => {
    const { app } = await setup();
    const response = await app.request('https://metrack.example/api/auth/google/start');
    expect(response.headers.getSetCookie()[0]).toContain('; Secure');
    expect(response.headers.get('location')).toContain(
      encodeURIComponent('https://metrack.example/api/auth/google/callback'),
    );
  });

  it('exchanges the code with the client secret and the PKCE verifier, and signs in a matching email', async () => {
    const { callback, tokenRequests, app } = await setup();
    const result = await callback({});
    expect(result.status).toBe(302);
    expect(result.location).toBe('/');
    expect(result.session).toMatch(
      /^metrack_session=[^;]+; Expires=.+; Path=\/; HttpOnly; SameSite=Lax$/,
    );
    expect(result.cookies.some((c) => c.startsWith('metrack_google_flow=; Max-Age=0'))).toBe(true);
    const request = tokenRequests[0]!;
    expect(request.get('code')).toBe('abc');
    expect(request.get('client_secret')).toBe('secret');
    expect(request.get('redirect_uri')).toBe(CALLBACK);
    expect(request.get('grant_type')).toBe('authorization_code');
    const challenge = createHash('sha256')
      .update(request.get('code_verifier')!)
      .digest('base64url');
    expect(result.started.location.searchParams.get('code_challenge')).toBe(challenge);
    const me = await app.request('http://localhost/api/auth/me', {
      headers: { cookie: result.session!.split(';')[0]! },
    });
    expect(await me.json()).toMatchObject({ name: 'Friend' });
  });

  it('links the sub on the first sign-in and then matches by sub even if the email changed', async () => {
    const { callback, users } = await setup();
    expect((await callback({})).location).toBe('/');
    expect(await users.googleSubOf(2)).toBe('sub-1');
    const again = await callback({ email: 'someone-else@example.com' });
    expect(again.location).toBe('/');
    expect(again.session).toBeDefined();
  });

  it('does not sign in a Google account with no matching user, and creates no user', async () => {
    const { callback, users } = await setup();
    const result = await callback({ sub: 'stranger', email: 'stranger@example.com' });
    expect(result.location).toBe('/login?error=google_no_account');
    expect(result.session).toBeUndefined();
    expect((await users.list()).map((user) => user.name)).toEqual(['Owner', 'Friend']);
  });

  it('does not sign in on an email match that Google has not verified', async () => {
    const { callback, users } = await setup();
    const result = await callback({ email_verified: false });
    expect(result.location).toBe('/login?error=google_no_account');
    expect(result.session).toBeUndefined();
    expect(await users.googleSubOf(2)).toBeNull();
  });

  it('does not take over a user already linked to another Google account', async () => {
    const { callback, users } = await setup();
    await users.setGoogleSub(2, 'other-sub');
    const result = await callback({});
    expect(result.location).toBe('/login?error=google_no_account');
    expect(result.session).toBeUndefined();
    expect(await users.googleSubOf(2)).toBe('other-sub');
  });

  it.each([
    ['a missing flow cookie', { cookie: '' }, {}],
    ['a state that differs from the cookie', { state: 'forged' }, {}],
    ['a wrong nonce', {}, { nonce: 'other' }],
    ['a wrong audience', {}, { aud: 'someone-else' }],
    ['a wrong issuer', {}, { iss: 'https://evil.example' }],
    ['an expired token', {}, { exp: NOW.getTime() / 1000 - 1 }],
    ['a refused code', { tokenResponse: new Response('nope', { status: 400 }) }, {}],
  ])('rejects %s without a session', async (_name, options, claims) => {
    const { callback, users } = await setup();
    const result = await callback(claims, options);
    expect(result.location).toBe('/login?error=google_failed');
    expect(result.session).toBeUndefined();
    expect(await users.googleSubOf(2)).toBeNull();
  });

  it('accepts the bare accounts.google.com issuer', async () => {
    const { callback } = await setup();
    expect((await callback({ iss: 'accounts.google.com' })).location).toBe('/');
  });

  it('rejects an error answer from Google', async () => {
    const { app, begin } = await setup();
    const { cookie, location } = await begin();
    const response = await app.request(
      `http://localhost/api/auth/google/callback?error=access_denied&state=${location.searchParams.get('state')}`,
      { headers: { cookie } },
    );
    expect(response.headers.get('location')).toBe('/login?error=google_failed');
  });

  it('has no Google routes when it is not configured', async () => {
    const db = openTestDatabase();
    const users = new SqliteUserRepository(db);
    const sessions = new SessionService(new SqliteSessionRepository(db), users);
    const app = buildTestApp({
      appVersion: 'test',
      migrationRunner: new MigrationRunner(db, migrations),
      authenticator: new SessionCookieAuthenticator(sessions),
      scope: new AsyncUserScope(),
      auth: { sessions, users, devLogin: false },
    });
    for (const path of ['start', 'callback']) {
      expect((await app.request(`http://localhost/api/auth/google/${path}`)).status).toBe(404);
    }
    const health = await app.request('http://localhost/api/health');
    expect((await health.json()).features.googleLogin).toBe(false);
  });

  it('reports itself in the health features when configured', async () => {
    const { app } = await setup();
    const health = await app.request('http://localhost/api/health');
    expect((await health.json()).features.googleLogin).toBe(true);
  });
});
