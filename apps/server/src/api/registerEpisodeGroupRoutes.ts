import type { EpisodeGroupOptions, SeasonOrderingRequest } from '@metrack/domain';
import type { MediaEditor } from '../media/MediaEditor.js';
import type { EpisodeGroupService } from '../seasons/EpisodeGroupService.js';
import type { ApiRoutes } from './ApiRoutes.js';
import { idParams } from './schemas/mediaSchemas.js';

const orderingBody = {
  type: 'object',
  properties: { episodeGroup: { type: ['string', 'null'], minLength: 1 } },
  required: ['episodeGroup'],
  additionalProperties: false,
} as const;

const orderingQuery = {
  type: 'object',
  properties: { forAll: { type: 'boolean' } },
  additionalProperties: false,
} as const;

/**
 * `GET /api/series/{id}/episode-groups` lists the season orderings TMDB has for a series, and
 * `PUT /api/series/{id}/season-ordering` switches the series to one. Only the owner may pass `forAll` to change
 * the ordering of a series other users have too.
 */
export function registerEpisodeGroupRoutes(
  routes: ApiRoutes,
  groups: EpisodeGroupService,
  editor: MediaEditor,
): void {
  routes.get<{ Params: { id: number } }>(
    '/api/series/:id/episode-groups',
    { schema: { params: idParams } },
    async (request): Promise<EpisodeGroupOptions> => groups.options(request.params.id),
  );

  routes.put<{
    Params: { id: number };
    Querystring: { forAll?: boolean };
    Body: SeasonOrderingRequest;
  }>(
    '/api/series/:id/season-ordering',
    { schema: { params: idParams, querystring: orderingQuery, body: orderingBody } },
    async (request) => {
      await groups.apply(request.params.id, request.body.episodeGroup, {
        allowSharedCatalog: request.query.forAll === true && request.user?.role === 'owner',
      });
      return editor.detail('series', request.params.id);
    },
  );
}
