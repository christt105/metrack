import type { ApiRoutes } from './ApiRoutes.js';
import type {
  AccountDeletion,
  AccountStatus,
  DeleteAccountRequest,
  User,
  WelcomeRequest,
} from '@metrack/domain';
import type { AccountDeletionService } from '../account/AccountDeletionService.js';
import type { AccountExporter } from '../account/AccountExporter.js';
import type { PublicProfileRepository } from '../storage/repositories/PublicProfileRepository.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import { bytesBody } from './bytesBody.js';
import { ApiError } from './ApiError.js';
import { parseHandle } from './parseHandle.js';
import { requireUser } from './requireUser.js';
import { savePublicPage } from './savePublicPage.js';

const deleteBody = {
  type: 'object',
  properties: { confirm: { type: 'string', maxLength: 200 } },
  required: ['confirm'],
  additionalProperties: false,
} as const;

const welcomeBody = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 200 },
    handle: { type: 'string', maxLength: 200 },
  },
  required: ['name', 'handle'],
  additionalProperties: false,
} as const;

const NAME_MAX = 80;

export interface AccountRouteDeps {
  users: UserRepository;
  exporter: AccountExporter;
  /** Whether the server builds the export ZIP itself; the Worker leaves it to the browser. */
  serverZip: boolean;
  deletion: AccountDeletionService;
  profiles: PublicProfileRepository;
}

/**
 * The signed-in user's own account. `GET /api/account/export/data` answers their data as JSON, with the
 * images they own listed, and `GET /api/account/export` downloads a ZIP with both when the server builds it
 * (a token may call either). `GET /api/account` says whether a deletion is waiting, `POST
 * /api/account/deletion` schedules one, confirmed by typing the user's handle or `delete`, and `DELETE
 * /api/account/deletion` cancels it. `POST /api/account/welcome` is the first entry of a user who joined by
 * invitation: they confirm their display name and public page handle, validated as in the settings. The last three need the browser session, so a token cannot delete an
 * account, and the owner's account cannot be deleted at all.
 */
export function registerAccountRoutes(routes: ApiRoutes, deps: AccountRouteDeps): void {
  routes.get('/api/account/export/data', async (request): Promise<Response> => {
    const data = await deps.exporter.data(requireUser(request.user).id);
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  });

  if (deps.serverZip) {
    routes.get('/api/account/export', async (request) => {
      const archive = await deps.exporter.build(requireUser(request.user).id);
      return new Response(bytesBody(archive.bytes), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${archive.fileName}"`,
          'Cache-Control': 'no-store',
        },
      });
    });
  }

  routes.post<{ Body: WelcomeRequest }>(
    '/api/account/welcome',
    { config: { sessionOnly: true }, schema: { body: welcomeBody } },
    async (request): Promise<User> => {
      const user = requireUser(request.user);
      if (await deps.users.isWelcomed(user.id)) {
        throw ApiError.conflict('already_welcomed', 'This account has already been set up');
      }
      const name = request.body.name.trim();
      if (name === '' || name.length > NAME_MAX) {
        throw ApiError.badRequest('invalid_name', `The name must have 1 to ${NAME_MAX} characters`);
      }
      const handle = parseHandle(request.body.handle);
      if (handle === null) throw ApiError.badRequest('handle_required', 'Choose a handle');
      const current = await deps.profiles.get(user.id);
      await savePublicPage(deps.profiles, user.id, { ...current, handle });
      await deps.users.completeWelcome(user.id, name, new Date().toISOString());
      return { ...user, name };
    },
  );

  routes.get(
    '/api/account',
    { config: { sessionOnly: true } },
    async (request): Promise<AccountStatus> => deps.deletion.status(requireUser(request.user).id),
  );

  routes.post<{ Body: DeleteAccountRequest }>(
    '/api/account/deletion',
    { config: { sessionOnly: true }, schema: { body: deleteBody } },
    async (request): Promise<AccountDeletion> => {
      const user = requireUser(request.user);
      if (!(await deps.deletion.status(user.id)).canDelete) {
        throw new ApiError(403, 'owner_cannot_delete', 'The owner account cannot be deleted');
      }
      const handle = (await deps.profiles.get(user.id)).handle;
      const typed = request.body.confirm.trim().toLowerCase();
      if (typed !== 'delete' && (handle === null || typed !== handle.toLowerCase())) {
        throw ApiError.badRequest(
          'confirmation_mismatch',
          'Type your handle or the word "delete" to confirm',
        );
      }
      return deps.deletion.request(user.id);
    },
  );

  routes.delete(
    '/api/account/deletion',
    { config: { sessionOnly: true } },
    async (request): Promise<AccountStatus> => {
      const user = requireUser(request.user);
      await deps.deletion.cancel(user.id);
      return deps.deletion.status(user.id);
    },
  );
}
