import type { AccountDeletion, UserSummary } from '@metrack/domain';
import type { AccountDeletionService } from '../account/AccountDeletionService.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import { ApiError } from './ApiError.js';
import type { ApiRoutes } from './ApiRoutes.js';
import { noContent } from './noContent.js';

const params = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
} as const;

export interface UserAdminDeps {
  users: UserRepository;
  deletion: AccountDeletionService;
  images?: ImageStore;
}

/**
 * The owner's users panel. `GET /api/users/summary` lists every account with its email, sign-up date, storage used
 * and any waiting deletion. `POST /api/users/{id}/deletion` schedules the deletion of an account, which waits out
 * the grace period like the account's own request and tells the user, and `DELETE` cancels it. User 1 is never
 * deleted.
 */
export function registerUserAdminRoutes(routes: ApiRoutes, deps: UserAdminDeps): void {
  routes.get(
    '/api/users/summary',
    { config: { ownerOnly: true } },
    async (): Promise<UserSummary[]> => {
      const created = await deps.users.createdAtByUser();
      const summaries: UserSummary[] = [];
      for (const user of await deps.users.list()) {
        summaries.push({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: created.get(user.id) ?? '',
          usedBytes: deps.images ? (await deps.images.usage(user.id)).usedBytes : 0,
          deletion: (await deps.deletion.status(user.id)).deletion,
        });
      }
      return summaries;
    },
  );

  routes.post<{ Params: { id: number } }>(
    '/api/users/:id/deletion',
    { config: { ownerOnly: true }, schema: { params } },
    async (request): Promise<AccountDeletion> => deps.deletion.request(request.params.id, true),
  );

  routes.delete<{ Params: { id: number } }>(
    '/api/users/:id/deletion',
    { config: { ownerOnly: true }, schema: { params } },
    async (request) => {
      if (!(await deps.users.get(request.params.id))) {
        throw ApiError.notFound('That user does not exist');
      }
      await deps.deletion.cancel(request.params.id, true);
      return noContent();
    },
  );
}
