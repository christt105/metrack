import type {
  EpisodeOperation,
  SeasonEpisodesResponse,
  SeasonEpisodesUpdateResponse,
} from '@metrack/domain';
import type { SeasonEpisodesService } from '../seasons/SeasonEpisodesService.js';
import type { ContentVersions } from '../site/ContentVersions.js';
import type { ApiRoutes } from './ApiRoutes.js';
import { episodeOperationBody } from './schemas/episodeOperationBody.js';
import { rewatchIntentBody } from './schemas/rewatchIntentBody.js';
import { idParams } from './schemas/mediaSchemas.js';

/**
 * `GET /api/seasons/{id}/episodes` answers with the episodes of a season and the user's watches of them. It is a
 * read, so it does not bump the content version, except when opening the season changed its shared episode count:
 * the library list shows that number, so the signed-in user's version is bumped and every list revalidates.
 * `PATCH` marks, unmarks or edits the viewings of episodes and answers with the episodes and the season's tracking
 * after the change; it is a write, so the content version is bumped by the usual write path. `PUT` on
 * `/api/seasons/{id}/rewatch-intent` sets or clears the intention to watch the season again and answers the same.
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

  routes.patch<{ Params: { id: number }; Body: EpisodeOperation }>(
    '/api/seasons/:id/episodes',
    { schema: { params: idParams, body: episodeOperationBody } },
    async (request): Promise<SeasonEpisodesUpdateResponse> => {
      const { response } = await episodes.update(request.params.id, request.body);
      return response;
    },
  );

  routes.put<{ Params: { id: number }; Body: { wanted: boolean } }>(
    '/api/seasons/:id/rewatch-intent',
    { schema: { params: idParams, body: rewatchIntentBody } },
    async (request): Promise<SeasonEpisodesUpdateResponse> => {
      const { response } = await episodes.setRewatchIntent(request.params.id, request.body.wanted);
      return response;
    },
  );
}
