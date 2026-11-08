import type { ApiRoutes } from './ApiRoutes.js';
import { jsonResponse } from './jsonResponse.js';
import { noContent } from './noContent.js';
import {
  TOKEN_SCOPES,
  type ApiToken,
  type CreatedToken,
  type CreateTokenRequest,
} from '@metrack/domain';
import type { ApiTokenService } from '../auth/ApiTokenService.js';
import { ApiError } from './ApiError.js';

const params = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
} as const;

const createBody = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 200 },
    scope: { type: 'string', enum: [...TOKEN_SCOPES] },
    expiresInDays: { type: ['integer', 'null'] },
  },
  required: ['name', 'scope', 'expiresInDays'],
  additionalProperties: false,
} as const;

/**
 * The signed-in user's personal API tokens: `GET /api/tokens` lists them, `POST /api/tokens` creates
 * one and answers its secret once, `DELETE /api/tokens/{id}` revokes one. All need the browser
 * session, so a token cannot mint or revoke tokens.
 */
export function registerTokenRoutes(routes: ApiRoutes, tokens: ApiTokenService): void {
  const userId = (user: { id: number } | null): number => user?.id ?? 0;

  routes.get(
    '/api/tokens',
    { config: { sessionOnly: true } },
    async (request): Promise<ApiToken[]> => tokens.list(userId(request.user)),
  );

  routes.post<{ Body: CreateTokenRequest }>(
    '/api/tokens',
    { config: { sessionOnly: true }, schema: { body: createBody } },
    async (request) => {
      const created: CreatedToken = await tokens.create(userId(request.user), request.body);
      return jsonResponse(created, 201);
    },
  );

  routes.delete<{ Params: { id: number } }>(
    '/api/tokens/:id',
    { config: { sessionOnly: true }, schema: { params } },
    async (request) => {
      if (!(await tokens.revoke(userId(request.user), request.params.id))) {
        throw ApiError.notFound('You have no token with that id');
      }
      return noContent();
    },
  );
}
