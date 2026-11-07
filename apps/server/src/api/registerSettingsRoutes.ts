import type { FastifyInstance } from 'fastify';
import {
  applySettingsPatch,
  WEB_EDITABLE_SETTINGS,
  type OwnSettings,
  type UserSettings,
  type UserSettingsPatch,
  type UserWithSettings,
} from '@metrack/domain';
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
 */
export function registerSettingsRoutes(
  app: FastifyInstance,
  users: UserRepository,
  settings: UserSettingsRepository,
): void {
  const settingsOf = async (userId: number): Promise<UserSettings> =>
    (await settings.get(userId)) ?? NO_SETTINGS;

  app.get(
    '/api/settings',
    { config: { sessionOnly: true } },
    async (request): Promise<OwnSettings> => {
      const userId = request.user?.id ?? 0;
      return { settings: await settingsOf(userId), owner: userId === OWNER_ID };
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
}
