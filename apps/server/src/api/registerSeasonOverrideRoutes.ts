import type { ApiRoutes } from './ApiRoutes.js';
import { noContent } from './noContent.js';
import type { SeasonOverrideInput } from '@metrack/domain';
import type { SeasonOverrideRepository } from '../storage/repositories/SeasonOverrideRepository.js';
import type { SeriesRepository } from '../storage/repositories/SeriesRepository.js';
import { ApiError } from './ApiError.js';

const params = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    tmdbSeasonNumber: { type: 'integer', minimum: 0 },
  },
  required: ['id', 'tmdbSeasonNumber'],
} as const;

const body = {
  type: 'object',
  properties: {
    number: { type: ['integer', 'null'], minimum: 0 },
    title: { type: ['string', 'null'] },
    jellyfinSeasonId: { type: ['string', 'null'] },
  },
  additionalProperties: false,
} as const;

/** Manual season corrections, keyed by the series and the TMDB season number they correct. */
export function registerSeasonOverrideRoutes(
  routes: ApiRoutes,
  series: SeriesRepository,
  overrides: SeasonOverrideRepository,
): void {
  const requireSeries = async (id: number): Promise<void> => {
    if (!(await series.get(id))) throw ApiError.notFound();
  };

  routes.get<{ Params: { id: number } }>(
    '/api/series/:id/overrides',
    { schema: { params: { type: 'object', properties: { id: { type: 'integer' } } } } },
    async (request) => {
      await requireSeries(request.params.id);
      return await overrides.listBySeries(request.params.id);
    },
  );

  routes.put<{
    Params: { id: number; tmdbSeasonNumber: number };
    Body: Partial<SeasonOverrideInput>;
  }>(
    '/api/series/:id/overrides/:tmdbSeasonNumber',
    { schema: { params, body } },
    async (request) => {
      await requireSeries(request.params.id);
      return await overrides.set({
        seriesId: request.params.id,
        tmdbSeasonNumber: request.params.tmdbSeasonNumber,
        number: request.body.number ?? null,
        title: request.body.title ?? null,
        jellyfinSeasonId: request.body.jellyfinSeasonId ?? null,
      });
    },
  );

  routes.delete<{ Params: { id: number; tmdbSeasonNumber: number } }>(
    '/api/series/:id/overrides/:tmdbSeasonNumber',
    { schema: { params } },
    async (request) => {
      await requireSeries(request.params.id);
      if (!(await overrides.delete(request.params.id, request.params.tmdbSeasonNumber))) {
        throw ApiError.notFound();
      }
      return noContent();
    },
  );
}
