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
import { DATE_PATTERN } from './schemas/fieldTypes.js';
import { idParams } from './schemas/mediaSchemas.js';

const restartDayQuery = {
  type: 'object',
  properties: { day: { type: 'string', pattern: DATE_PATTERN } },
  additionalProperties: false,
} as const;

const passParams = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    pass: { type: 'integer', minimum: 1, maximum: 1000 },
  },
  required: ['id', 'pass'],
} as const;

/**
 * `GET /api/seasons/{id}/episodes` answers with the episodes of a season and the user's watches of them. It is a
 * read, so it does not bump the content version, except when opening the season changed its shared episode count:
 * the library list shows that number, so the signed-in user's version is bumped and every list revalidates.
 * `PATCH` marks, unmarks or edits the viewings of episodes and answers with the episodes and the season's tracking
 * after the change; it is a write, so the content version is bumped by the usual write path. `PUT` on
 * `/api/seasons/{id}/rewatch-intent` sets or clears the intention to watch the season again and answers the same.
 * `POST` and `DELETE` on `/api/seasons/{id}/restart` start the season over and take that back (the one of `?day=`,
 * the latest by default), with the same answer, and `DELETE /api/seasons/{id}/passes/{pass}` deletes one pass.
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

  routes.post<{ Params: { id: number } }>(
    '/api/seasons/:id/restart',
    { schema: { params: idParams } },
    async (request): Promise<SeasonEpisodesUpdateResponse> => {
      const { response } = await episodes.restart(request.params.id);
      return response;
    },
  );

  routes.delete<{ Params: { id: number }; Querystring: { day?: string } }>(
    '/api/seasons/:id/restart',
    { schema: { params: idParams, querystring: restartDayQuery } },
    async (request): Promise<SeasonEpisodesUpdateResponse> => {
      const { response } = await episodes.undoRestart(request.params.id, request.query.day);
      return response;
    },
  );

  routes.delete<{ Params: { id: number; pass: number } }>(
    '/api/seasons/:id/passes/:pass',
    { schema: { params: passParams } },
    async (request): Promise<SeasonEpisodesUpdateResponse> => {
      const { response } = await episodes.removePass(request.params.id, request.params.pass);
      return response;
    },
  );
}
