import type { ApiRoutes } from './ApiRoutes.js';
import {
  ASSIGNABLE_ROLES,
  PUBLIC_PAGE_LIMITS,
  isGiscusRepo,
  applySettingsPatch,
  handleProblem,
  normalizeHandle,
  type GiscusConfig,
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
import { isImageHash } from '../images/imageRef.js';
import type { ImageStore } from '../images/ImageStore.js';
import { HandleTakenError } from '../storage/HandleTakenError.js';
import type { PublicProfileRepository } from '../storage/repositories/PublicProfileRepository.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import { NO_SETTINGS } from '../users/NO_SETTINGS.js';
import { OWNER_ID } from '../users/OWNER_ID.js';
import { ApiError } from './ApiError.js';
import { requireUser } from './requireUser.js';

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
  properties: {
    handle: { type: ['string', 'null'] },
    enabled: { type: 'boolean' },
    avatar: { type: ['string', 'null'] },
    intro: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    about: { type: ['string', 'null'] },
    giscus: {
      type: ['object', 'null'],
      properties: {
        repo: { type: 'string' },
        repoId: { type: 'string' },
        category: { type: 'string' },
        categoryId: { type: 'string' },
      },
      required: ['repo', 'repoId', 'category', 'categoryId'],
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

const OWN_IMAGE = /^\/api\/images\/([0-9a-f]{64})$/;

function limitedText(
  value: string | null,
  field: 'intro' | 'description' | 'about',
): string | null {
  const text = value?.trim() ?? '';
  if (text.length > PUBLIC_PAGE_LIMITS[field]) {
    throw ApiError.badRequest(
      'invalid_public_page',
      `The ${field} may have at most ${PUBLIC_PAGE_LIMITS[field]} characters`,
    );
  }
  return text === '' ? null : text;
}

function validGiscus(value: GiscusConfig | null): GiscusConfig | null {
  if (value === null) return null;
  const giscus: GiscusConfig = {
    repo: value.repo.trim(),
    repoId: value.repoId.trim(),
    category: value.category.trim(),
    categoryId: value.categoryId.trim(),
  };
  const values = Object.values(giscus);
  if (values.every((entry) => entry === '')) return null;
  if (
    values.some((entry) => entry === '' || entry.length > PUBLIC_PAGE_LIMITS.giscus) ||
    !isGiscusRepo(giscus.repo)
  ) {
    throw ApiError.badRequest(
      'invalid_giscus',
      'Comments need the repository as owner/name and the repository id, category and category id, each at most 100 characters',
    );
  }
  return giscus;
}

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
 * public page (handle, on/off, avatar, texts and comments) with `PATCH /api/settings/public-page`.
 */
export function registerSettingsRoutes(
  routes: ApiRoutes,
  users: UserRepository,
  settings: UserSettingsRepository,
  profiles: PublicProfileRepository,
  images?: ImageStore,
): void {
  const settingsOf = async (userId: number): Promise<UserSettings> =>
    (await settings.get(userId)) ?? NO_SETTINGS;

  routes.get(
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

  routes.patch<{ Body: PublicPagePatch }>(
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
      const body = request.body;
      let avatar = current.avatar;
      if (body.avatar !== undefined) {
        avatar = body.avatar === null || body.avatar === '' ? null : body.avatar;
        const hash = avatar === null ? null : (OWN_IMAGE.exec(avatar)?.[1] ?? null);
        if (avatar !== null) {
          const user = requireUser(request.user);
          const image = hash !== null && isImageHash(hash) ? await images?.get(hash) : undefined;
          if (!image || !(await images?.canRead(image.hash, user))) {
            throw ApiError.badRequest('invalid_avatar', 'Choose an image you uploaded');
          }
        }
      }
      const page: PublicPage = {
        handle,
        enabled,
        avatar,
        intro: body.intro === undefined ? current.intro : limitedText(body.intro, 'intro'),
        description:
          body.description === undefined
            ? current.description
            : limitedText(body.description, 'description'),
        about: body.about === undefined ? current.about : limitedText(body.about, 'about'),
        giscus: body.giscus === undefined ? current.giscus : validGiscus(body.giscus),
      };
      if (enabled && handle === null) {
        throw ApiError.badRequest('handle_required', 'Choose a handle before turning the page on');
      }
      const owner = handle === null ? undefined : await profiles.findByHandle(handle);
      if (owner && owner.userId !== userId) {
        throw ApiError.conflict('handle_taken', 'Another user already has that handle');
      }
      try {
        await profiles.save(userId, page);
      } catch (error) {
        if (error instanceof HandleTakenError) {
          throw ApiError.conflict('handle_taken', 'Another user already has that handle');
        }
        throw error;
      }
      return page;
    },
  );

  routes.get(
    '/api/users',
    { config: { ownerOnly: true } },
    async (): Promise<UserWithSettings[]> => {
      const stored = new Map(
        (await settings.list()).map((entry) => [entry.userId, entry.settings]),
      );
      return (await users.list()).map((user) => ({
        user,
        settings: stored.get(user.id) ?? NO_SETTINGS,
      }));
    },
  );

  routes.patch<{ Params: { id: number }; Body: UserSettingsPatch }>(
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

  routes.put<{ Params: { id: number }; Body: RoleChange }>(
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
