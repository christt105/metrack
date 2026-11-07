import type { FastifyInstance } from 'fastify';
import {
  ASSIGNABLE_ROLES,
  applySettingsPatch,
  handleProblem,
  normalizeHandle,
  type PublicPage,
  type PublicPagePatch,
  type RoleChange,
  type User,
  WEB_EDITABLE_SETTINGS,
  type OwnSettings,
  type UserSettings,
  type UserSettingsPatch,
  type UserWithSettings,
} from '@metrack/domain';
import { HandleTakenError } from '../storage/HandleTakenError.js';
import type { PublicProfileRepository } from '../storage/repositories/PublicProfileRepository.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import { NO_SETTINGS } from '../users/NO_SETTINGS.js';
import { OWNER_ID } from '../users/OWNER_ID.js';
import { ApiError } from './ApiError.js';
import './fastifyTypes.js';

const params = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
} as const;

const roleBody = {
  type: 'object',
  properties: { role: { type: 'string', enum: [...ASSIGNABLE_ROLES] } },
  required: ['role'],
  additionalProperties: false,
} as const;

const publicPageBody = {
  type: 'object',
  properties: { handle: { type: ['string', 'null'] }, enabled: { type: 'boolean' } },
  additionalProperties: false,
} as const;

const patchBody = {
  type: 'object',
  properties: Object.fromEntries(
    WEB_EDITABLE_SETTINGS.map((key) => [key, { type: ['string', 'null'] }]),
  ),
  additionalProperties: false,
} as const;

/**
 * `GET /api/settings` shows the signed-in user what their background jobs act on. Each setting points the instance's
 * credentials (Jellyfin, ntfy, Cloudflare) or its disk at something, so only the owner changes them: `GET /api/users`
 * lists everyone with their settings and `PATCH /api/users/{id}/settings` changes the web-editable ones of any user.
 * `PUT /api/users/{id}/role` makes a user trusted or normal; user 1 is always the owner. Every user sets their own
 * public page (handle and on/off) with `PATCH /api/settings/public-page`.
 */
export function registerSettingsRoutes(
  app: FastifyInstance,
  users: UserRepository,
  settings: UserSettingsRepository,
  profiles: PublicProfileRepository,
): void {
  const settingsOf = async (userId: number): Promise<UserSettings> =>
    (await settings.get(userId)) ?? NO_SETTINGS;

  app.get(
    '/api/settings',
    { config: { sessionOnly: true } },
    async (request): Promise<OwnSettings> => {
      const userId = request.user?.id ?? 0;
      return {
        settings: await settingsOf(userId),
        publicPage: await profiles.get(userId),
        owner: userId === OWNER_ID,
      };
    },
  );

  app.patch<{ Body: PublicPagePatch }>(
    '/api/settings/public-page',
    { config: { sessionOnly: true }, schema: { body: publicPageBody } },
    async (request): Promise<PublicPage> => {
      const userId = request.user?.id ?? 0;
      const current = await profiles.get(userId);
      let handle = current.handle;
      if (request.body.handle !== undefined) {
        const wanted = normalizeHandle(request.body.handle ?? '');
        const problem = wanted === '' ? null : handleProblem(wanted);
        if (problem) throw ApiError.badRequest('invalid_handle', `The handle must be ${problem}`);
        handle = wanted === '' ? null : wanted;
      }
      const enabled = request.body.enabled ?? current.enabled;
      if (enabled && handle === null) {
        throw ApiError.badRequest('handle_required', 'Choose a handle before turning the page on');
      }
      const owner = handle === null ? undefined : await profiles.findByHandle(handle);
      if (owner && owner.userId !== userId) {
        throw ApiError.conflict('handle_taken', 'Another user already has that handle');
      }
      try {
        await profiles.save(userId, { handle, enabled });
      } catch (error) {
        if (error instanceof HandleTakenError) {
          throw ApiError.conflict('handle_taken', 'Another user already has that handle');
        }
        throw error;
      }
      return { handle, enabled };
    },
  );

  app.get('/api/users', { config: { ownerOnly: true } }, async (): Promise<UserWithSettings[]> => {
    const stored = new Map((await settings.list()).map((entry) => [entry.userId, entry.settings]));
    return (await users.list()).map((user) => ({
      user,
      settings: stored.get(user.id) ?? NO_SETTINGS,
    }));
  });

  app.patch<{ Params: { id: number }; Body: UserSettingsPatch }>(
    '/api/users/:id/settings',
    { config: { ownerOnly: true }, schema: { params, body: patchBody } },
    async (request): Promise<UserSettings> => {
      const { id } = request.params;
      if (!(await users.get(id))) throw ApiError.notFound('That user does not exist');
      const result = applySettingsPatch(await settingsOf(id), request.body);
      if (!result.ok) {
        throw ApiError.badRequest(
          'invalid_settings',
          'Some settings are not valid',
          result.problems,
        );
      }
      await settings.save(id, result.settings);
      return result.settings;
    },
  );

  app.put<{ Params: { id: number }; Body: RoleChange }>(
    '/api/users/:id/role',
    { config: { ownerOnly: true }, schema: { params, body: roleBody } },
    async (request): Promise<User> => {
      const { id } = request.params;
      if (id === OWNER_ID) {
        throw ApiError.badRequest('owner_role_fixed', 'The owner is always user 1');
      }
      if (!(await users.get(id))) throw ApiError.notFound('That user does not exist');
      await users.setRole(id, request.body.role);
      return (await users.get(id)) as User;
    },
  );
}
