import { STEAM_APPLY_BATCH_SIZE, type SteamApplyRequest } from '@metrack/domain';
import type { SteamImportService } from '../steam/SteamImportService.js';
import { ApiError } from './ApiError.js';
import type { ApiRoutes } from './ApiRoutes.js';
import { requireUser } from './requireUser.js';

const applyBody = {
  type: 'object',
  properties: {
    appIds: {
      type: 'array',
      items: { type: 'string', pattern: '^[0-9]{1,10}$' },
    },
  },
  required: ['appIds'],
  additionalProperties: false,
} as const;

/**
 * Steam library import of the signed-in user, for the Steam account in their settings. `GET /api/steam/report` reads
 * Steam and the library and writes nothing. `POST /api/steam/apply` takes at most `STEAM_APPLY_BATCH_SIZE` app ids, so
 * one request stays under the Workers subrequest limit; it recomputes what each id does from Steam's current answer
 * and writes it, and an id that is already in the library with at least Steam's time is skipped, so repeating a batch
 * adds nothing. `POST /api/steam/artwork` prepares the artwork of the games that import added with it deferred, as many as
 * fit in one request, and answers how many it finished and how many remain. All answer 501 when the server has no Steam API key or no IGDB credentials.
 */
export function registerSteamRoutes(
  routes: ApiRoutes,
  steam: SteamImportService | undefined,
): void {
  const ready = (): SteamImportService => {
    if (!steam) {
      throw ApiError.notImplemented(
        'steam_not_configured',
        'Steam import needs STEAM_API_KEY and the IGDB credentials (IGDB_CLIENT_ID and IGDB_CLIENT_SECRET)',
      );
    }
    return steam;
  };

  routes.get('/api/steam/report', async (request) => ready().report(requireUser(request.user).id));

  routes.post('/api/steam/artwork', async (request) =>
    ready().prepareArtwork(requireUser(request.user).id),
  );

  routes.post<{ Body: SteamApplyRequest }>(
    '/api/steam/apply',
    { schema: { body: applyBody } },
    async (request) => {
      const { appIds } = request.body;
      if (appIds.length === 0 || appIds.length > STEAM_APPLY_BATCH_SIZE) {
        throw ApiError.badRequest(
          'invalid_batch',
          `Send between 1 and ${STEAM_APPLY_BATCH_SIZE} app ids per request`,
        );
      }
      return { outcomes: await ready().apply(requireUser(request.user).id, appIds) };
    },
  );
}
