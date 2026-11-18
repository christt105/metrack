import type { SeasonEpisodesResponse } from '@metrack/domain';
import type { SeasonEpisodesService } from '../seasons/SeasonEpisodesService.js';
import type { ContentVersions } from '../site/ContentVersions.js';
import type { ApiRoutes } from './ApiRoutes.js';
import { idParams } from './schemas/mediaSchemas.js';

/**
 * `GET /api/seasons/{id}/episodes` answers with the episodes of a season and the user's watches of them. It is a
 * read, so it does not bump the content version, except when opening the season changed its shared episode count:
 * the library list shows that number, so the signed-in user's version is bumped and every list revalidates.
 */
export function registerSeasonEpisodeRoutes(
  routes: ApiRoutes,
  episodes: SeasonEpisodesService,
  versions?: ContentVersions,
): void {
  routes.get<{ Params: { id: number } }>(
    '/api/seasons/:id/episodes',
    { schema: { params: idParams } },
    async (request): Promise<SeasonEpisodesResponse> => {
      const { response, episodeCountChanged } = await episodes.get(request.params.id);
      if (episodeCountChanged && versions && request.user) await versions.bump(request.user.id);
      return response;
    },
  );
}
