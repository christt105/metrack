import { randomBytes } from 'node:crypto';
import {
  TOKEN_LIFETIMES_DAYS,
  TOKEN_NAME_MAX,
  TOKEN_SCOPES,
  type ApiToken,
  type CreatedToken,
  type CreateTokenRequest,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import { OWNER_ID } from '../users/OWNER_ID.js';
import type { ApiTokenRepository } from '../storage/repositories/ApiTokenRepository.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import { hashSecret } from './hashSecret.js';
import type { TokenSignIn } from './TokenSignIn.js';

const TOKEN_PREFIX = 'mt_';
const DAY_MS = 24 * 3_600_000;
const LAST_USED_GRANULARITY_MS = 60_000;

/**
 * Creates, lists, revokes and resolves personal API tokens, for programs that call the API on a
 * user's behalf without their browser session. Only the SHA-256 of a secret is stored; last use is
 * recorded at most once a minute so frequent calls do not turn into a write each.
 */
export class ApiTokenService {
  constructor(
    private readonly tokens: ApiTokenRepository,
    private readonly users: UserRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(userId: number, request: CreateTokenRequest): Promise<CreatedToken> {
    const name = request.name.trim();
    if (name === '' || name.length > TOKEN_NAME_MAX) {
      throw ApiError.badRequest(
        'invalid_token_name',
        `Give the token a name of 1 to ${TOKEN_NAME_MAX} characters`,
      );
    }
    if (!TOKEN_SCOPES.includes(request.scope)) {
      throw ApiError.badRequest(
        'invalid_token_scope',
        `Scope must be one of ${TOKEN_SCOPES.join(', ')}`,
      );
    }
    if (!TOKEN_LIFETIMES_DAYS.includes(request.expiresInDays)) {
      throw ApiError.badRequest('invalid_token_lifetime', 'Pick one of the offered lifetimes');
    }
    if (request.scope === 'connector' && userId !== OWNER_ID) {
      throw ApiError.forbidden('owner_only', 'Only the owner can create a connector token');
    }
    const now = this.now();
    const secret = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const token = await this.tokens.create({
      userId,
      name,
      scope: request.scope,
      secretHash: hashSecret(secret),
      createdAt: now.toISOString(),
      expiresAt:
        request.expiresInDays === null
          ? null
          : new Date(now.getTime() + request.expiresInDays * DAY_MS).toISOString(),
    });
    return { token, secret };
  }

  list(userId: number): Promise<ApiToken[]> {
    return this.tokens.listForUser(userId);
  }

  revoke(userId: number, id: number): Promise<boolean> {
    return this.tokens.delete(userId, id);
  }

  /** Who a secret signs in, or undefined when it is unknown, revoked or expired. */
  async resolve(secret: string): Promise<TokenSignIn | undefined> {
    if (!secret.startsWith(TOKEN_PREFIX)) return undefined;
    const token = await this.tokens.bySecretHash(hashSecret(secret));
    const now = this.now();
    if (!token || (token.expiresAt !== null && token.expiresAt <= now.toISOString())) {
      return undefined;
    }
    const user = await this.users.get(token.userId);
    if (!user) return undefined;
    const lastUsed = token.lastUsedAt === null ? 0 : Date.parse(token.lastUsedAt);
    if (now.getTime() - lastUsed >= LAST_USED_GRANULARITY_MS) {
      await this.tokens.markUsed(token.id, now.toISOString());
    }
    return { user, scope: token.scope };
  }
}
