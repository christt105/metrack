import { generateNtfyTopic } from '@metrack/domain';
import type { Hono } from 'hono';
import { AccountExporter } from '../account/AccountExporter.js';
import { WatchlistService } from '../alerts/WatchlistService.js';
import type { ApiEnv } from '../api/ApiEnv.js';
import { buildApp } from '../api/buildApp.js';
import { ApiTokenService } from '../auth/ApiTokenService.js';
import { SessionCookieAuthenticator } from '../auth/SessionCookieAuthenticator.js';
import { SessionService } from '../auth/SessionService.js';
import { D1ContentVersions } from '../storage/d1/D1ContentVersions.js';
import { D1PublicRenderCache } from '../storage/d1/D1PublicRenderCache.js';
import { SequentialTransactionRunner } from '../storage/SequentialTransactionRunner.js';
import { ConnectorService } from '../sync/ConnectorService.js';
import { SyncApplier } from '../sync/SyncApplier.js';
import { secureRandomBytes } from '../users/secureRandomBytes.js';
import { createWorkerServices } from './createWorkerServices.js';
import { D1SchemaVersion } from './D1SchemaVersion.js';
import type { WorkerEnv } from './WorkerEnv.js';
import type { WorkerServices } from './WorkerServices.js';

/**
 * The same Hono app as the home server, over D1 and R2. Images are always recoded by the browser
 * (`IMAGE_ENCODED_BY=client`). Everything that needs Node, the disk, a timer or a service at home is left out:
 * reading Jellyfin and Jellystat (the home connector does it and writes through `/api/connector`), the vault mirror, Hugo publishing, backups, and the account export ZIP (the browser
 * builds it from `/api/account/export/data`) and release alerts. The erasing of deleted accounts is not a route: it runs
 * from the Worker's `scheduled` handler, over the same services.
 */
export function createWorkerApp(
  env: WorkerEnv,
  now: () => Date = () => new Date(),
  services: WorkerServices = createWorkerServices(env, now),
): Hono<ApiEnv> {
  const { config, logger, scope, repositories, imageStore, metadataCache, edit } = services;
  const { movies, series, seasons, videogames, books } = repositories;
  const contentVersions = new D1ContentVersions(env.DB);
  const targets = {
    movies,
    series,
    seasons,
    overrides: repositories.overrides,
    unlinked: repositories.unlinked,
  };
  const sessions = new SessionService(repositories.sessions, repositories.users);
  return buildApp({
    appVersion: config.appVersion,
    migrationRunner: new D1SchemaVersion(env.DB),
    authenticator: new SessionCookieAuthenticator(sessions),
    scope,
    auth: { sessions, users: repositories.users, devLogin: config.devLogin },
    tokens: new ApiTokenService(repositories.apiTokens, repositories.users),
    logger,
    imageStore,
    metadataCache,
    edit,
    account: {
      exporter: new AccountExporter(
        { ...repositories, images: imageStore },
        () => new Date(),
        false,
      ),
      serverZip: false,
      deletion: services.accountDeletion,
      profiles: repositories.profiles,
    },
    handAddedCatalog: repositories.handAddedCatalog,
    settings: {
      users: repositories.users,
      settings: repositories.settings,
      profiles: repositories.profiles,
      generateNtfyTopic: () => generateNtfyTopic(secureRandomBytes),
    },
    site: {
      profiles: repositories.profiles,
      sources: { movies, series, seasons, videogames, books },
      publicUrl: config.publicUrl,
      contactEmail: config.contactEmail,
      renderCache: new D1PublicRenderCache(env.DB, now),
    },
    contentVersions,
    connector: new ConnectorService({
      users: repositories.users,
      settings: repositories.settings,
      targets,
      applier: new SyncApplier(new SequentialTransactionRunner(), targets),
      versions: contentVersions,
      scope,
      metadata: metadataCache,
      editor: edit.editor,
    }),
    watch: {
      watchlist: new WatchlistService(edit.editor, movies, series, seasons),
      alerts: repositories.releaseAlerts,
    },
  });
}
