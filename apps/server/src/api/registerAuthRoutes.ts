import type { ApiRoutes } from './ApiRoutes.js';
import { jsonResponse } from './jsonResponse.js';
import type { RouteRequest } from './RouteRequest.js';
import type { DevLoginRequest, TokenLoginRequest } from '@metrack/domain';
import { readCookie } from '../auth/readCookie.js';
import { clearedSessionCookie, SESSION_COOKIE, sessionCookie } from '../auth/sessionCookie.js';
import { ApiError } from './ApiError.js';
import type { ApiTokenService } from '../auth/ApiTokenService.js';
import {
  clearedGoogleFlowCookie,
  GOOGLE_FLOW_COOKIE,
  googleFlowCookie,
} from '../auth/google/googleFlowCookie.js';
import type { GoogleSignIn } from '../auth/google/GoogleSignIn.js';
import type { GoogleCallbackQuery } from '../auth/google/GoogleCallbackQuery.js';
import type { AuthRouteDeps } from './AuthRouteDeps.js';

const tokenLoginBody = {
  type: 'object',
  properties: { token: { type: 'string', maxLength: 200 } },
  required: ['token'],
  additionalProperties: false,
} as const;

const devLoginBody = {
  type: 'object',
  properties: { userId: { type: 'integer', minimum: 1 } },
  required: ['userId'],
  additionalProperties: false,
} as const;

/**
 * `GET /api/auth/me` answers the signed-in user and `POST /api/auth/logout` ends the session. With dev
 * login on, `GET /api/auth/dev-users` lists who can sign in and `POST /api/auth/dev-login` signs in as
 * any of them; with it off, both routes do not exist. `POST /api/auth/token-login` exchanges a valid
 * `write` personal API token for a normal session of the token's user. With Google sign-in on,
 * `GET /api/auth/google/start` and `/callback` sign in a user that already exists; the browser leaves with a redirect either way.
 */
export function registerAuthRoutes(
  routes: ApiRoutes,
  deps: AuthRouteDeps,
  tokens?: ApiTokenService,
): void {
  routes.get('/api/auth/me', async (request) => request.user);

  routes.post('/api/auth/logout', { config: { public: true } }, async (request) => {
    const token = readCookie(request.headers.get('cookie') ?? undefined, SESSION_COOKIE);
    if (token !== undefined) await deps.sessions.end(token);
    return new Response(null, {
      status: 204,
      headers: { 'set-cookie': clearedSessionCookie(isHttps(request)) },
    });
  });

  if (tokens) {
    routes.post<{ Body: TokenLoginRequest }>(
      '/api/auth/token-login',
      { config: { public: true }, schema: { body: tokenLoginBody } },
      async (request) => {
        const signIn = await tokens.resolve(request.body.token);
        if (!signIn) throw new ApiError(401, 'bad_token', 'Unknown or expired token');
        if (signIn.scope !== 'write') {
          throw new ApiError(403, 'read_only_token', 'Only a token with write access can sign in');
        }
        const { token, expiresAt } = await deps.sessions.start(signIn.user.id);
        const response = jsonResponse(signIn.user);
        response.headers.set('set-cookie', sessionCookie(token, expiresAt, isHttps(request)));
        return response;
      },
    );
  }

  if (deps.google) registerGoogleRoutes(routes, deps, deps.google);

  if (!deps.devLogin) return;

  routes.get('/api/auth/dev-users', { config: { public: true } }, async () => deps.users.list());

  routes.post<{ Body: DevLoginRequest }>(
    '/api/auth/dev-login',
    { config: { public: true }, schema: { body: devLoginBody } },
    async (request) => {
      const user = await deps.users.get(request.body.userId);
      if (!user) throw ApiError.notFound('That user does not exist');
      const { token, expiresAt } = await deps.sessions.start(user.id);
      const response = jsonResponse(user);
      response.headers.set('set-cookie', sessionCookie(token, expiresAt, isHttps(request)));
      return response;
    },
  );
}

function registerGoogleRoutes(routes: ApiRoutes, deps: AuthRouteDeps, google: GoogleSignIn): void {
  const redirectUri = (request: RouteRequest): string =>
    `${request.url.origin}/api/auth/google/callback`;

  routes.get('/api/auth/google/start', { config: { public: true } }, async (request) => {
    const { location, flow } = await google.begin(redirectUri(request));
    const response = redirect(location);
    response.headers.append('set-cookie', googleFlowCookie(flow, isHttps(request)));
    return response;
  });

  routes.get<{ Querystring: GoogleCallbackQuery }>(
    '/api/auth/google/callback',
    { config: { public: true } },
    async (request) => {
      const secure = isHttps(request);
      const flow = readCookie(request.headers.get('cookie') ?? undefined, GOOGLE_FLOW_COOKIE);
      const outcome = await google.complete(
        redirectUri(request),
        {
          code: single(request.query.code),
          state: single(request.query.state),
          error: single(request.query.error),
        },
        flow,
      );
      let response: Response;
      if (outcome.kind === 'signed-in') {
        const { token, expiresAt } = await deps.sessions.start(outcome.userId);
        response = redirect('/');
        response.headers.append('set-cookie', sessionCookie(token, expiresAt, secure));
      } else if (outcome.kind === 'no-account') {
        response = redirect('/login?error=google_no_account');
      } else {
        deps.logger?.error(`Google sign-in failed: ${outcome.reason}`);
        response = redirect('/login?error=google_failed');
      }
      response.headers.append('set-cookie', clearedGoogleFlowCookie(secure));
      return response;
    },
  );
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isHttps(request: RouteRequest): boolean {
  return request.url.protocol === 'https:';
}
