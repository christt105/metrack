import type { Hono } from 'hono';
import { canAddByHand } from '@metrack/domain';
import type { ApiTokenService } from '../auth/ApiTokenService.js';
import type { Authenticator } from '../auth/Authenticator.js';
import { readBearerToken } from '../auth/readBearerToken.js';
import { OWNER_ID } from '../users/OWNER_ID.js';
import type { UserScope } from '../users/UserScope.js';
import type { ApiEnv } from './ApiEnv.js';
import type { ApiRoutes } from './ApiRoutes.js';
import { jsonResponse } from './jsonResponse.js';

const READ_METHODS = new Set(['GET', 'HEAD']);

/**
 * Requires a signed-in user on every `/api` route not flagged `public`, answering 401 otherwise, and runs the rest
 * of the request as that user, so repositories only see their data. Routes flagged `ownerOnly` act on the whole
 * instance and answer 403 to anyone but the owner. The check runs on the matched route, so an unknown path stays a
 * plain 404.
 *
 * A request with an `Authorization` header signs in with a personal API token instead of the session cookie.
 * Tokens never reach `ownerOnly` or `sessionOnly` routes, and a `read` token only reads. Routes flagged
 * `trustedOnly` answer 403 to normal users, however they sign in. A `connector` token is accepted only on routes
 * flagged `connector`, which in turn accept only tokens.
 */
export function registerAuthGuard(
  app: Hono<ApiEnv>,
  routes: ApiRoutes,
  authenticator: Authenticator,
  scope: UserScope,
  tokens?: ApiTokenService,
): void {
  app.use('*', async (context, next) => {
    context.set('user', null);
    context.set('tokenScope', null);
    const matched = [...context.req.matchedRoutes]
      .reverse()
      .find((entry) => entry.method !== 'ALL');
    if (matched === undefined || !matched.path.startsWith('/api/')) return next();
    const flags = routes.flagsOf(matched.method, matched.path);
    if (flags.public) return next();
    const method = context.req.method;
    const headers = context.req.raw.headers;
    const bearer = readBearerToken(headers.get('authorization') ?? undefined);
    let user;
    if (bearer !== undefined) {
      const signIn = bearer === '' || !tokens ? undefined : await tokens.resolve(bearer);
      if (!signIn) {
        return jsonResponse({ error: 'Unknown or expired token', code: 'bad_token' }, 401);
      }
      if (flags.ownerOnly || flags.sessionOnly) {
        return jsonResponse(
          { error: 'Sign in to the web app to do this', code: 'session_required' },
          403,
        );
      }
      if (signIn.scope === 'connector' && !flags.connector) {
        return jsonResponse(
          { error: 'A connector token only works on /api/connector', code: 'connector_token_only' },
          403,
        );
      }
      if (signIn.scope === 'read' && !READ_METHODS.has(method)) {
        return jsonResponse({ error: 'This token can only read', code: 'read_only_token' }, 403);
      }
      user = signIn.user;
      context.set('tokenScope', signIn.scope);
    } else {
      if (flags.connector) {
        return jsonResponse(
          { error: 'The connector API needs an API token', code: 'token_required' },
          403,
        );
      }
      user = await authenticator.userFor(headers);
      if (!user) return jsonResponse({ error: 'Sign in first', code: 'unauthenticated' }, 401);
      if (flags.ownerOnly && user.id !== OWNER_ID) {
        return jsonResponse({ error: 'Only the owner can do this', code: 'owner_only' }, 403);
      }
    }
    if (flags.trustedOnly && !canAddByHand(user.role)) {
      return jsonResponse({ error: 'Only trusted users can do this', code: 'trusted_only' }, 403);
    }
    context.set('user', user);
    await scope.run(user.id, () => next());
    return undefined;
  });
}
