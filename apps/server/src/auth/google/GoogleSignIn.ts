import type { GoogleLoginConfig } from '../../config/GoogleLoginConfig.js';
import type { FetchFn } from '../../http/FetchFn.js';
import type { UserRepository } from '../../storage/repositories/UserRepository.js';
import { decodeJwtPayload } from './decodeJwtPayload.js';
import { GOOGLE_FLOW_TTL_SECONDS } from './googleFlowCookie.js';
import type { GoogleCallbackQuery } from './GoogleCallbackQuery.js';
import type { GoogleFlowStart } from './GoogleFlowStart.js';
import type { GoogleSignInOutcome } from './GoogleSignInOutcome.js';
import { pkceChallenge } from './pkceChallenge.js';
import { randomUrlToken } from './randomUrlToken.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * The authorization-code flow with PKCE against Google, to sign in users that already exist. The id token comes
 * straight from Google's token endpoint over TLS, so its claims are checked but its signature is not. A Google
 * account is matched by its `sub`; the first time, by a verified email address equal to the user's, and then the
 * `sub` is stored. No user is ever created.
 */
export class GoogleSignIn {
  constructor(
    private readonly config: GoogleLoginConfig,
    private readonly users: UserRepository,
    private readonly fetchFn: FetchFn = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async begin(redirectUri: string): Promise<GoogleFlowStart> {
    const state = randomUrlToken();
    const nonce = randomUrlToken();
    const verifier = randomUrlToken(48);
    const expiresAt = this.now().getTime() + GOOGLE_FLOW_TTL_SECONDS * 1000;
    const query = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state,
      nonce,
      code_challenge: await pkceChallenge(verifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return {
      location: `${AUTHORIZE_URL}?${query.toString()}`,
      flow: [state, nonce, verifier, expiresAt].join('.'),
    };
  }

  async complete(
    redirectUri: string,
    query: GoogleCallbackQuery,
    flow: string | undefined,
  ): Promise<GoogleSignInOutcome> {
    const [state, nonce, verifier, expiresAt] = flow?.split('.') ?? [];
    if (!state || !nonce || !verifier || Number(expiresAt) <= this.now().getTime()) {
      return failed('the sign-in flow cookie is missing or expired');
    }
    if (query.state !== state) return failed('the state does not match');
    if (query.error) return failed(`Google answered with the error ${query.error}`);
    if (!query.code) return failed('Google sent no code');
    const idToken = await this.exchange(query.code, verifier, redirectUri);
    if (typeof idToken !== 'string') return idToken;
    const claims = decodeJwtPayload(idToken);
    if (!claims) return failed('the id token is not readable');
    const problem = this.claimsProblem(claims, nonce);
    if (problem) return failed(problem);
    return this.match(String(claims.sub), claims);
  }

  private async exchange(
    code: string,
    verifier: string,
    redirectUri: string,
  ): Promise<string | GoogleSignInOutcome> {
    try {
      const response = await this.fetchFn(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        }),
      });
      if (!response.ok) return failed(`the token endpoint answered ${response.status}`);
      const body = (await response.json()) as { id_token?: unknown };
      return typeof body.id_token === 'string' ? body.id_token : failed('no id token was returned');
    } catch (error) {
      return failed(`the token endpoint could not be reached: ${String(error)}`);
    }
  }

  private claimsProblem(claims: Record<string, unknown>, nonce: string): string | undefined {
    if (typeof claims.iss !== 'string' || !ISSUERS.includes(claims.iss)) return 'wrong issuer';
    const audience = claims.aud;
    const audiences = Array.isArray(audience) ? audience : [audience];
    if (!audiences.includes(this.config.clientId)) return 'wrong audience';
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= this.now().getTime()) {
      return 'the id token has expired';
    }
    if (claims.nonce !== nonce) return 'the nonce does not match';
    if (typeof claims.sub !== 'string' || claims.sub === '') return 'no subject';
    return undefined;
  }

  private async match(sub: string, claims: Record<string, unknown>): Promise<GoogleSignInOutcome> {
    const linked = await this.users.findByGoogleSub(sub);
    if (linked) return { kind: 'signed-in', userId: linked.id };
    if (
      (claims.email_verified !== true && claims.email_verified !== 'true') ||
      typeof claims.email !== 'string'
    ) {
      return { kind: 'no-account' };
    }
    const candidate = await this.users.findByEmail(claims.email);
    if (!candidate || (await this.users.googleSubOf(candidate.id)) !== null) {
      return { kind: 'no-account' };
    }
    if (!(await this.users.linkGoogleSub(candidate.id, sub))) return { kind: 'no-account' };
    return { kind: 'signed-in', userId: candidate.id };
  }
}

function failed(reason: string): GoogleSignInOutcome {
  return { kind: 'failed', reason };
}
