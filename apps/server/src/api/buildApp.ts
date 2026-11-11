import { Hono } from 'hono';
import { createHealthReport } from '@metrack/domain';
import { registerAuthGuard } from './registerAuthGuard.js';
import { registerAuthRoutes } from './registerAuthRoutes.js';
import { registerArtworkRoutes } from './registerArtworkRoutes.js';
import { registerErrorHandler } from './registerErrorHandler.js';
import { registerImageRoutes } from './registerImageRoutes.js';
import { registerMetadataRoutes } from './registerMetadataRoutes.js';
import { registerMediaRoutes } from './registerMediaRoutes.js';
import { onSuccessfulApiWrite } from './onSuccessfulApiWrite.js';
import { jsonResponse } from './jsonResponse.js';
import { ApiRoutes } from './ApiRoutes.js';
import type { ApiEnv } from './ApiEnv.js';
import type { StaticFiles } from '../web/StaticFiles.js';
import { registerPublishRoutes } from './registerPublishRoutes.js';
import { registerSeasonOverrideRoutes } from './registerSeasonOverrideRoutes.js';
import { registerSyncRoutes } from './registerSyncRoutes.js';
import { registerWatchlistRoutes } from './registerWatchlistRoutes.js';
import { registerTitleRoutes } from './registerTitleRoutes.js';
import type { ReleaseAlertRepository } from '../storage/repositories/ReleaseAlertRepository.js';
import type { WatchlistService } from '../alerts/WatchlistService.js';
import type { EditServices } from './EditServices.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import { registerBackupRoutes, type BackupRouteDeps } from './registerBackupRoutes.js';
import type { UserSyncServices } from '../sync/UserSyncServices.js';
import type { UserQueues } from '../users/UserQueues.js';
import type { SchemaVersionSource } from '../storage/SchemaVersionSource.js';
import type { Logger } from '../notify/Logger.js';
import type { Authenticator } from '../auth/Authenticator.js';
import type { AuthRouteDeps } from './AuthRouteDeps.js';
import type { UserScope } from '../users/UserScope.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import type { PublicProfileRepository } from '../storage/repositories/PublicProfileRepository.js';
import { registerPublicPageRoutes } from '../site/registerPublicPageRoutes.js';
import { publicNotFound } from '../site/publicNotFound.js';
import type { PublicSiteSources } from '../site/PublicSiteSources.js';
import { registerSettingsRoutes } from './registerSettingsRoutes.js';
import { registerAccountRoutes, type AccountRouteDeps } from './registerAccountRoutes.js';
import { registerCatalogRoutes } from './registerCatalogRoutes.js';
import type { HandAddedCatalogRepository } from '../storage/repositories/HandAddedCatalogRepository.js';
import { registerTokenRoutes } from './registerTokenRoutes.js';
import type { ApiTokenService } from '../auth/ApiTokenService.js';
import type { WebhookSecret } from './WebhookSecret.js';

export interface AppDeps {
  appVersion: string;
  migrationRunner: SchemaVersionSource;
  /** Tells who signed in; every `/api` route that is not public needs a user. */
  authenticator: Authenticator;
  /** Binds each request to its user. */
  scope: UserScope;
  auth?: AuthRouteDeps;
  /** Personal API tokens: lets programs sign in with `Authorization: Bearer`, and their routes. */
  tokens?: ApiTokenService;
  /** Receives the failures answered with a 5xx status. */
  logger?: Logger;
  /** The built web app, served for every address that is not the API. */
  web?: StaticFiles;
  imageStore?: ImageStore;
  metadataCache?: MetadataCache;
  /** Publishes the site of each user who has one. */
  publishQueues?: UserQueues;
  /** Refreshes each user's read-only notes in their vault after a change. */
  mirrorQueues?: UserQueues;
  edit?: EditServices;
  backup?: BackupRouteDeps;
  sync?: UserSyncServices;
  syncQueues?: UserQueues;
  /** Shows each user their settings and lets the owner change everyone's. */
  settings?: {
    users: UserRepository;
    settings: UserSettingsRepository;
    profiles: PublicProfileRepository;
  };
  /** Export and deletion of the signed-in user's own account. */
  account?: AccountRouteDeps;
  /** Lets the owner and trusted users delete hand-added catalog items nobody has any more. */
  handAddedCatalog?: HandAddedCatalogRepository;
  /** Required from the Jellyfin webhook when set. */
  syncWebhookSecret?: WebhookSecret;
  watch?: { watchlist: WatchlistService; alerts: ReleaseAlertRepository };
  /** Serves each user's public page under `/u/<handle>/` while they have it on. */
  site?: {
    profiles: PublicProfileRepository;
    sources: PublicSiteSources;
    /** Address the feeds link to; the visitor's own address when null. */
    publicUrl: string | null;
    /** Where the privacy page says to write about one's data. */
    contactEmail: string;
  };
}

export function buildApp(deps: AppDeps): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  const routes = new ApiRoutes(app);
  registerErrorHandler(app, deps.logger);
  registerAuthGuard(app, routes, deps.authenticator, deps.scope, deps.tokens);
  if (deps.publishQueues) {
    const queues = deps.publishQueues;
    onSuccessfulApiWrite(app, () => queues.markAllDirty(), deps.logger);
  }
  if (deps.mirrorQueues) {
    const queues = deps.mirrorQueues;
    onSuccessfulApiWrite(app, () => queues.markAllDirty(), deps.logger);
  }
  if (deps.auth) registerAuthRoutes(routes, deps.auth, deps.tokens);
  if (deps.tokens) registerTokenRoutes(routes, deps.tokens);

  routes.get('/api/health', { config: { public: true } }, async () => {
    const report = createHealthReport(deps.appVersion, await deps.migrationRunner.currentVersion());
    return jsonResponse(report, report.status === 'ok' ? 200 : 503);
  });

  if (deps.imageStore) registerImageRoutes(routes, deps.imageStore);
  if (deps.metadataCache) registerMetadataRoutes(routes, deps.metadataCache, deps.edit?.editor);
  if (deps.edit) {
    const { editor, catalog, artwork, titleProviders, unlinked, resolver, series, overrides } =
      deps.edit;
    registerMediaRoutes(routes, editor, catalog);
    registerSeasonOverrideRoutes(routes, series, overrides);
    registerArtworkRoutes(routes, artwork, editor);
    registerTitleRoutes(routes, titleProviders, unlinked, resolver);
  }
  if (deps.watch) registerWatchlistRoutes(routes, deps.watch.watchlist, deps.watch.alerts);
  registerSyncRoutes(routes, deps.sync, deps.syncQueues, deps.syncWebhookSecret);
  if (deps.settings)
    registerSettingsRoutes(
      routes,
      deps.settings.users,
      deps.settings.settings,
      deps.settings.profiles,
      deps.imageStore,
    );
  if (deps.account) registerAccountRoutes(routes, deps.account);
  if (deps.handAddedCatalog) registerCatalogRoutes(routes, deps.handAddedCatalog);
  if (deps.site) {
    registerPublicPageRoutes(app, { ...deps.site, scope: deps.scope, images: deps.imageStore });
  }
  if (deps.backup) registerBackupRoutes(routes, deps.backup);
  if (deps.publishQueues) registerPublishRoutes(routes, deps.publishQueues);

  const web = deps.web;
  app.notFound(async (context) => {
    const request = context.req.raw;
    const { pathname } = new URL(request.url);
    const reads = request.method === 'GET' || request.method === 'HEAD';
    const file = web && reads ? await web.file(pathname, request) : undefined;
    if (file) return file;
    if (pathname === '/u' || pathname.startsWith('/u/')) return publicNotFound();
    if (web && request.method === 'GET' && !pathname.startsWith('/api/')) {
      const index = await web.index(request);
      if (index) return index;
    }
    return jsonResponse({ error: 'Not found', code: 'not_found' }, 404);
  });

  return app;
}
