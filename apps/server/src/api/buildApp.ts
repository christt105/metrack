import { Hono } from 'hono';
import { createHealthReport } from '@metrack/domain';
import { languageFromAcceptLanguage } from '@metrack/site';
import { registerAuthGuard } from './registerAuthGuard.js';
import { registerAuthRoutes } from './registerAuthRoutes.js';
import { registerArtworkRoutes } from './registerArtworkRoutes.js';
import { registerSecurityHeaders } from './registerSecurityHeaders.js';
import { registerErrorHandler } from './registerErrorHandler.js';
import { registerImageRoutes } from './registerImageRoutes.js';
import { registerMetadataRoutes } from './registerMetadataRoutes.js';
import { registerEpisodeGroupRoutes } from './registerEpisodeGroupRoutes.js';
import { registerFillerRoutes } from './registerFillerRoutes.js';
import { registerNextEpisodeRoutes } from './registerNextEpisodeRoutes.js';
import { registerSeasonEpisodeRoutes } from './registerSeasonEpisodeRoutes.js';
import { registerMediaRoutes } from './registerMediaRoutes.js';
import { bumpContentVersionOnWrite } from './bumpContentVersionOnWrite.js';
import type { ContentVersions } from '../site/ContentVersions.js';
import type { PublicRenderCache } from '../site/PublicRenderCache.js';
import { onSuccessfulApiWrite } from './onSuccessfulApiWrite.js';
import { jsonResponse } from './jsonResponse.js';
import { ApiRoutes } from './ApiRoutes.js';
import type { ApiEnv } from './ApiEnv.js';
import type { StaticFiles } from '../web/StaticFiles.js';
import { registerSteamRoutes } from './registerSteamRoutes.js';
import type { SteamIdResolver } from '../steam/SteamIdResolver.js';
import type { SteamAchievementsService } from '../steam/SteamAchievementsService.js';
import type { SteamImportService } from '../steam/SteamImportService.js';
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
import { registerInviteRoutes } from './registerInviteRoutes.js';
import { registerUserAdminRoutes, type UserAdminDeps } from './registerUserAdminRoutes.js';
import type { InviteService } from '../invites/InviteService.js';
import { registerCatalogRoutes } from './registerCatalogRoutes.js';
import type { HandAddedCatalogRepository } from '../storage/repositories/HandAddedCatalogRepository.js';
import { registerTokenRoutes } from './registerTokenRoutes.js';
import type { ApiTokenService } from '../auth/ApiTokenService.js';
import type { WebhookSecret } from './WebhookSecret.js';
import { registerConnectorRoutes } from './registerConnectorRoutes.js';
import type { ConnectorService } from '../sync/ConnectorService.js';

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
  /** Refreshes each user's read-only notes in their vault after a change. */
  mirrorQueues?: UserQueues;
  edit?: EditServices;
  backup?: BackupRouteDeps;
  sync?: UserSyncServices;
  /** Imports the Steam library of the signed-in user; Steam routes answer 501 without it. */
  steam?: SteamImportService;
  /** Checks the Steam achievements of the signed-in user's games; the route answers 501 without it. */
  steamAchievements?: SteamAchievementsService;
  syncQueues?: UserQueues;
  /** Shows each user their settings and lets the owner change everyone's. */
  settings?: {
    users: UserRepository;
    settings: UserSettingsRepository;
    profiles: PublicProfileRepository;
    /** When set, users turn release alerts on, regenerate and turn them off themselves and the topic is never typed. */
    generateNtfyTopic?: () => string;
    /** Turns a typed Steam profile into its SteamID64; vanity names need a Steam API key. */
    steamIds?: SteamIdResolver;
  };
  /** The owner's invitation links, and the public page that previews one. */
  invites?: InviteService;
  /** The owner's users panel: accounts with their storage, and scheduling their deletion. */
  userAdmin?: Omit<UserAdminDeps, 'images'>;
  /** Export and deletion of the signed-in user's own account. */
  account?: AccountRouteDeps;
  /** Lets the owner and trusted users delete hand-added catalog items nobody has any more. */
  handAddedCatalog?: HandAddedCatalogRepository;
  /** The routes the home connector syncs through, `/api/connector`. */
  connector?: ConnectorService;
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
    /** Stores rendered pages; every page is rendered per request when unset. */
    renderCache?: PublicRenderCache;
  };
  /** Bumped after each successful write so stored renders go stale; needed whenever `site.renderCache` is set. */
  contentVersions?: ContentVersions;
}

export function buildApp(deps: AppDeps): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  const routes = new ApiRoutes(app);
  registerSecurityHeaders(app);
  registerErrorHandler(app, deps.logger);
  registerAuthGuard(app, routes, deps.authenticator, deps.scope, deps.tokens);
  if (deps.contentVersions) bumpContentVersionOnWrite(app, deps.contentVersions, deps.logger);
  if (deps.mirrorQueues) {
    const queues = deps.mirrorQueues;
    onSuccessfulApiWrite(app, () => queues.markAllDirty(), deps.logger);
  }
  if (deps.auth) registerAuthRoutes(routes, deps.auth, deps.tokens);
  if (deps.tokens) registerTokenRoutes(routes, deps.tokens);

  routes.get('/api/health', { config: { public: true } }, async () => {
    const report = createHealthReport(
      deps.appVersion,
      await deps.migrationRunner.currentVersion(),
      {
        backups: deps.backup !== undefined,
        sync: deps.sync !== undefined,
        googleLogin: deps.auth?.google !== undefined,
        steam: deps.steam !== undefined,
      },
    );
    return jsonResponse(report, report.status === 'ok' ? 200 : 503);
  });

  if (deps.imageStore) registerImageRoutes(routes, deps.imageStore);
  if (deps.metadataCache) registerMetadataRoutes(routes, deps.metadataCache, deps.edit?.editor);
  if (deps.edit) {
    const { editor, catalog, artwork, titleProviders, unlinked, resolver } = deps.edit;
    if (deps.edit.episodeGroups) {
      registerEpisodeGroupRoutes(routes, deps.edit.episodeGroups, editor);
    }
    registerSeasonEpisodeRoutes(routes, deps.edit.seasonEpisodes, deps.contentVersions);
    registerNextEpisodeRoutes(routes, deps.edit.nextEpisodes);
    registerFillerRoutes(routes, deps.edit.filler, deps.contentVersions);
    registerMediaRoutes(
      routes,
      editor,
      catalog,
      deps.contentVersions && { versions: deps.contentVersions, appVersion: deps.appVersion },
    );
    registerArtworkRoutes(routes, artwork, editor);
    registerTitleRoutes(routes, titleProviders, unlinked, resolver);
  }
  if (deps.watch) registerWatchlistRoutes(routes, deps.watch.watchlist, deps.watch.alerts);
  registerSyncRoutes(routes, deps.sync, deps.syncQueues, deps.syncWebhookSecret);
  registerSteamRoutes(routes, deps.steam, deps.steamAchievements);
  if (deps.connector) registerConnectorRoutes(routes, deps.connector);
  if (deps.settings)
    registerSettingsRoutes(
      routes,
      deps.settings.users,
      deps.settings.settings,
      deps.settings.profiles,
      deps.imageStore,
      deps.settings.generateNtfyTopic,
      deps.settings.steamIds,
    );
  if (deps.account) registerAccountRoutes(routes, deps.account);
  if (deps.invites) registerInviteRoutes(routes, deps.invites);
  if (deps.userAdmin)
    registerUserAdminRoutes(routes, { ...deps.userAdmin, images: deps.imageStore });
  if (deps.handAddedCatalog) registerCatalogRoutes(routes, deps.handAddedCatalog);
  if (deps.site) {
    registerPublicPageRoutes(app, { ...deps.site, scope: deps.scope, images: deps.imageStore });
  }
  if (deps.backup) registerBackupRoutes(routes, deps.backup);

  const web = deps.web;
  app.notFound(async (context) => {
    const request = context.req.raw;
    const { pathname } = new URL(request.url);
    const reads = request.method === 'GET' || request.method === 'HEAD';
    const file = web && reads ? await web.file(pathname, request) : undefined;
    if (file) return file;
    if (pathname === '/u' || pathname.startsWith('/u/'))
      return publicNotFound(languageFromAcceptLanguage(request.headers.get('accept-language')));
    if (web && request.method === 'GET' && !pathname.startsWith('/api/')) {
      const index = await web.index(request);
      if (index) return index;
    }
    return jsonResponse({ error: 'Not found', code: 'not_found' }, 404);
  });

  return app;
}
