import {
  INVITE_LIMITS,
  type CreateInviteRequest,
  type Invite,
  type InvitePreview,
} from '@metrack/domain';
import type { InviteService } from '../invites/InviteService.js';
import { ApiError } from './ApiError.js';
import type { ApiRoutes } from './ApiRoutes.js';
import { jsonResponse } from './jsonResponse.js';
import { noContent } from './noContent.js';

const codeParams = {
  type: 'object',
  properties: { code: { type: 'string', maxLength: 100 } },
  required: ['code'],
} as const;

const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
} as const;

const createBody = {
  type: 'object',
  properties: {
    maxUses: { type: 'integer', minimum: 1, maximum: INVITE_LIMITS.maxUses },
    expiresInDays: { type: 'integer', minimum: 1, maximum: INVITE_LIMITS.maxExpiryDays },
  },
  required: ['maxUses'],
  additionalProperties: false,
} as const;

/**
 * The invitation links that let friends join. `GET /api/invites/{code}` is public and spends nothing: it says
 * whether the link works and who invites, which is all the invitation page needs. The owner, with the browser
 * session, lists the links with `GET /api/invites`, creates one with `POST /api/invites` (the code is answered
 * once) and revokes one that still has uses left with `DELETE /api/invites/{id}`.
 */
export function registerInviteRoutes(routes: ApiRoutes, invites: InviteService): void {
  routes.get<{ Params: { code: string } }>(
    '/api/invites/:code',
    { config: { public: true }, schema: { params: codeParams } },
    async (request): Promise<InvitePreview> => invites.preview(request.params.code),
  );

  routes.get('/api/invites', { config: { ownerOnly: true } }, async (): Promise<Invite[]> =>
    invites.list(),
  );

  routes.post<{ Body: CreateInviteRequest }>(
    '/api/invites',
    { config: { ownerOnly: true }, schema: { body: createBody } },
    async (request) => jsonResponse(await invites.create(request.body), 201),
  );

  routes.delete<{ Params: { id: number } }>(
    '/api/invites/:id',
    { config: { ownerOnly: true }, schema: { params: idParams } },
    async (request) => {
      if (!(await invites.revoke(request.params.id))) {
        throw ApiError.conflict(
          'invite_not_revocable',
          'That invitation does not exist, is already revoked or has no uses left',
        );
      }
      return noContent();
    },
  );
}
