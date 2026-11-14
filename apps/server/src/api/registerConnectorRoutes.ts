import type { ConnectorSyncRequest, MediaType } from '@metrack/domain';
import type { ReconcileSeasonsRequest } from '../alerts/ReconcileSeasonsRequest.js';
import type { RecordAlertsRequest } from '../alerts/RecordAlertsRequest.js';
import type { ConnectorService } from '../sync/ConnectorService.js';
import { ApiError } from './ApiError.js';
import type { ApiRoutes } from './ApiRoutes.js';
import { jsonResponse } from './jsonResponse.js';
import type { RouteRequest } from './RouteRequest.js';
import { reconcileSeasonsBody } from './schemas/reconcileSeasonsBody.js';
import { recordAlertsBody } from './schemas/recordAlertsBody.js';
import { connectorSyncBody } from './schemas/connectorSyncBody.js';

const config = { connector: true } as const;

const userParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
} as const;

const refreshParams = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    type: { enum: ['movie', 'series'] },
    titleId: { type: 'integer', minimum: 1 },
  },
  required: ['id', 'type', 'titleId'],
} as const;

const SYNC_BODY_LIMIT = 8_388_608;

/**
 * The API of the home connector, which reads Jellyfin where the server cannot and writes the result here. Only API
 * tokens reach it. A `connector` token (the owner's) acts on every user with a Jellyfin account in their settings; a
 * personal `write` token only on its own user. `GET /api/connector/users` lists who the token may act on, `GET
 * /api/connector/users/{id}/sync-state` reads what the sync compares against with the content version it was read
 * at, `POST /api/connector/users/{id}/sync` applies a plan computed from that state and answers 409 when the version
 * has moved, and `POST /api/connector/users/{id}/refresh/{type}/{titleId}` fetches the metadata of one created title.
 * Release alerts have their own routes: `GET /api/connector/alert-users` lists the users with an ntfy topic, `GET
 * /api/connector/users/{id}/release-state` reads what the alerts need in one response, `POST
 * /api/connector/users/{id}/seasons` links and creates the seasons a series announces, and `POST
 * /api/connector/users/{id}/release-alerts` records delivered alerts, ignoring keys already recorded.
 */
export function registerConnectorRoutes(routes: ApiRoutes, service: ConnectorService): void {
  const mayAct = (request: RouteRequest, userId: number): void => {
    if (request.tokenScope !== 'connector' && request.user?.id !== userId) {
      throw ApiError.forbidden('connector_other_user', 'This token only acts on its own user');
    }
  };
  const allowedForAlerts = async (request: RouteRequest, userId: number): Promise<void> => {
    mayAct(request, userId);
    if (!(await service.alertUsers()).some((user) => user.id === userId)) {
      throw ApiError.notFound('That user has no ntfy topic set');
    }
  };
  const allowed = async (request: RouteRequest, userId: number): Promise<void> => {
    mayAct(request, userId);
    if (!(await service.user(userId))) {
      throw ApiError.notFound('That user has no Jellyfin account set');
    }
  };

  routes.get('/api/connector/users', { config }, async (request) => {
    const users = await service.users();
    return request.tokenScope === 'connector'
      ? users
      : users.filter((user) => user.id === request.user?.id);
  });

  routes.get<{ Params: { id: number } }>(
    '/api/connector/users/:id/sync-state',
    { config, schema: { params: userParams } },
    async (request) => {
      await allowed(request, request.params.id);
      return service.state(request.params.id);
    },
  );

  routes.post<{ Params: { id: number }; Body: ConnectorSyncRequest }>(
    '/api/connector/users/:id/sync',
    { config, schema: { params: userParams, body: connectorSyncBody }, bodyLimit: SYNC_BODY_LIMIT },
    async (request) => {
      await allowed(request, request.params.id);
      return service.apply(request.params.id, request.body);
    },
  );

  routes.post<{ Params: { id: number; type: MediaType; titleId: number } }>(
    '/api/connector/users/:id/refresh/:type/:titleId',
    { config, schema: { params: refreshParams } },
    async (request) => {
      await allowed(request, request.params.id);
      const { id, type, titleId } = request.params;
      return jsonResponse(await service.refresh(id, type, titleId));
    },
  );

  routes.get('/api/connector/alert-users', { config }, async (request) => {
    const users = await service.alertUsers();
    return request.tokenScope === 'connector'
      ? users
      : users.filter((user) => user.id === request.user?.id);
  });

  routes.get<{ Params: { id: number } }>(
    '/api/connector/users/:id/release-state',
    { config, schema: { params: userParams } },
    async (request) => {
      await allowedForAlerts(request, request.params.id);
      return service.releaseState(request.params.id);
    },
  );

  routes.post<{ Params: { id: number }; Body: ReconcileSeasonsRequest }>(
    '/api/connector/users/:id/seasons',
    { config, schema: { params: userParams, body: reconcileSeasonsBody } },
    async (request) => {
      await allowedForAlerts(request, request.params.id);
      return service.reconcile(request.params.id, request.body);
    },
  );

  routes.post<{ Params: { id: number }; Body: RecordAlertsRequest }>(
    '/api/connector/users/:id/release-alerts',
    { config, schema: { params: userParams, body: recordAlertsBody } },
    async (request) => {
      await allowedForAlerts(request, request.params.id);
      return service.recordAlerts(request.params.id, request.body);
    },
  );
}
