import type { FastifyInstance } from 'fastify';
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
  app: FastifyInstance,
  series: SeriesRepository,
  overrides: SeasonOverrideRepository,
): void {
  const requireSeries = (id: number): void => {
    if (!series.get(id)) throw ApiError.notFound();
  };

  app.get<{ Params: { id: number } }>(
    '/api/series/:id/overrides',
    { schema: { params: { type: 'object', properties: { id: { type: 'integer' } } } } },
    async (request) => {
      requireSeries(request.params.id);
      return overrides.listBySeries(request.params.id);
    },
  );

  app.put<{ Params: { id: number; tmdbSeasonNumber: number }; Body: Partial<SeasonOverrideInput> }>(
    '/api/series/:id/overrides/:tmdbSeasonNumber',
    { schema: { params, body } },
    async (request) => {
      requireSeries(request.params.id);
      return overrides.set({
        seriesId: request.params.id,
        tmdbSeasonNumber: request.params.tmdbSeasonNumber,
        number: request.body.number ?? null,
        title: request.body.title ?? null,
        jellyfinSeasonId: request.body.jellyfinSeasonId ?? null,
      });
    },
  );

  app.delete<{ Params: { id: number; tmdbSeasonNumber: number } }>(
    '/api/series/:id/overrides/:tmdbSeasonNumber',
    { schema: { params } },
    async (request, reply) => {
      requireSeries(request.params.id);
      if (!overrides.delete(request.params.id, request.params.tmdbSeasonNumber)) {
        throw ApiError.notFound();
      }
      return reply.code(204).send();
    },
  );
}
