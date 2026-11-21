import type { FillerPreviewResponse } from '@metrack/domain';
import type { FillerService } from '../filler/FillerService.js';
import type { ContentVersions } from '../site/ContentVersions.js';
import type { ApiRoutes } from './ApiRoutes.js';
import { fillerQuery } from './schemas/fillerQuery.js';
import { idParams } from './schemas/mediaSchemas.js';

/**
 * `GET /api/series/{id}/filler` answers with the series' episodes classified by AnimeFillerList, for the preview
 * of "Skip the filler". `slug` names the show on the site (a slug or its address); without it the series' titles
 * are tried. A successful match stores the category of every episode and the slug in the shared catalog, replacing
 * what was stored before, unless the caller signed in with a read-only token; errors store nothing. The content
 * version is bumped only when opening the seasons changed a shared episode count.
 */
export function registerFillerRoutes(
  routes: ApiRoutes,
  filler: FillerService,
  versions?: ContentVersions,
): void {
  routes.get<{ Params: { id: number }; Querystring: { slug?: string } }>(
    '/api/series/:id/filler',
    { schema: { params: idParams, querystring: fillerQuery } },
    async (request): Promise<FillerPreviewResponse> => {
      const { response, episodeCountChanged } = await filler.preview(
        request.params.id,
        request.query.slug,
        request.user !== null && request.tokenScope !== 'read',
      );
      if (episodeCountChanged && versions && request.user) await versions.bump(request.user.id);
      return response;
    },
  );
}
