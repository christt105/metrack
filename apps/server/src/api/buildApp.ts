import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { createHealthReport } from '@metrack/domain';
import { registerAuthGuard } from './registerAuthGuard.js';
import { registerAuthRoutes } from './registerAuthRoutes.js';
import { registerArtworkRoutes } from './registerArtworkRoutes.js';
import { registerErrorHandler } from './registerErrorHandler.js';
import { registerImageRoutes } from './registerImageRoutes.js';
import { registerMetadataRoutes } from './registerMetadataRoutes.js';
import { registerMediaRoutes } from './registerMediaRoutes.js';
import { registerMirrorHook } from './registerMirrorHook.js';
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
import type { MigrationRunner } from '../storage/MigrationRunner.js';
import type { Logger } from '../notify/Logger.js';
import type { Authenticator } from '../auth/Authenticator.js';
import type { AuthRouteDeps } from './AuthRouteDeps.js';
import type { UserScope } from '../users/UserScope.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import type { PublicProfileRepository } from '../storage/repositories/PublicProfileRepository.js';
import { registerPublicPageRoutes } from '../site/registerPublicPageRoutes.js';
import { sendPublicNotFound } from '../site/sendPublicNotFound.js';
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
  migrationRunner: MigrationRunner;
  /** Tells who signed in; every `/api` route that is not public needs a user. */
  authenticator: Authenticator;
  /** Binds each request to its user. */
  scope: UserScope;
  auth?: AuthRouteDeps;
  /** Personal API tokens: lets programs sign in with `Authorization: Bearer`, and their routes. */
  tokens?: ApiTokenService;
  /** Receives the failures answered with a 5xx status. */
  logger?: Logger;
  webDir?: string;
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

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: 'array' } },
  });
  registerErrorHandler(app, deps.logger);
  registerAuthGuard(app, deps.authenticator, deps.scope, deps.tokens);
  if (deps.auth) registerAuthRoutes(app, deps.auth);
  if (deps.tokens) registerTokenRoutes(app, deps.tokens);

  app.get('/api/health', { config: { public: true } }, async (_request, reply) => {
    const report = createHealthReport(deps.appVersion, deps.migrationRunner.currentVersion());
    return reply.code(report.status === 'ok' ? 200 : 503).send(report);
  });

  if (deps.imageStore) registerImageRoutes(app, deps.imageStore);
  if (deps.metadataCache) registerMetadataRoutes(app, deps.metadataCache, deps.edit?.editor);
  if (deps.edit) {
    const { editor, catalog, artwork, titleProviders, unlinked, resolver, series, overrides } =
      deps.edit;
    registerMediaRoutes(app, editor, catalog);
    registerSeasonOverrideRoutes(app, series, overrides);
    registerArtworkRoutes(app, artwork, editor);
    registerTitleRoutes(app, titleProviders, unlinked, resolver);
  }
  if (deps.watch) registerWatchlistRoutes(app, deps.watch.watchlist, deps.watch.alerts);
  registerSyncRoutes(app, deps.sync, deps.syncQueues, deps.syncWebhookSecret);
  if (deps.settings)
    registerSettingsRoutes(
      app,
      deps.settings.users,
      deps.settings.settings,
      deps.settings.profiles,
    );
  if (deps.account) registerAccountRoutes(app, deps.account);
  if (deps.handAddedCatalog) registerCatalogRoutes(app, deps.handAddedCatalog);
  if (deps.site) {
    registerPublicPageRoutes(app, { ...deps.site, scope: deps.scope, images: deps.imageStore });
  }
  if (deps.backup) registerBackupRoutes(app, deps.backup);
  if (deps.publishQueues) registerPublishRoutes(app, deps.publishQueues);
  if (deps.mirrorQueues) registerMirrorHook(app, deps.mirrorQueues);

  const webDir = deps.webDir ? resolve(deps.webDir) : undefined;
  const serveWeb = webDir !== undefined && existsSync(webDir);
  if (serveWeb) await app.register(fastifyStatic, { root: webDir });
  app.setNotFoundHandler((request, reply) => {
    if (request.url === '/u' || request.url.startsWith('/u/')) return sendPublicNotFound(reply);
    if (serveWeb && request.method === 'GET' && !request.url.startsWith('/api/')) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Not found', code: 'not_found' });
  });

  return app;
}
