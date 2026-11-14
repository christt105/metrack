import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  CreatedToken,
  ConnectorSyncRequest,
  Movie,
  Series,
  SyncPlan,
  TokenScope,
} from '@metrack/domain';
import { ApiTokenService } from '../../src/auth/ApiTokenService.js';
import { SessionCookieAuthenticator } from '../../src/auth/SessionCookieAuthenticator.js';
import { SessionService } from '../../src/auth/SessionService.js';
import { createImageStore } from '../../src/images/createImageStore.js';
import { MetadataCache } from '../../src/metadata/MetadataCache.js';
import { movieLifecycle } from '../../src/metadata/movieLifecycle.js';
import { seriesLifecycle } from '../../src/metadata/seriesLifecycle.js';
import { MemoryContentVersions } from '../../src/site/MemoryContentVersions.js';
import { ConnectorService } from '../../src/sync/ConnectorService.js';
import { SyncApplier } from '../../src/sync/SyncApplier.js';
import { createSqliteRepositories } from '../../src/storage/sqlite/createSqliteRepositories.js';
import { NO_SETTINGS } from '../../src/users/NO_SETTINGS.js';
import { AsyncUserScope } from '../../src/users/AsyncUserScope.js';
import { buildTestApp } from './buildTestApp.js';
import { fakeFetch } from './fakeFetch.js';
import { openTestDatabase } from './openTestDatabase.js';
import { ScriptedMetadataSource } from './ScriptedMetadataSource.js';

export const EMPTY_PLAN: SyncPlan = {
  movies: [],
  series: [],
  unlinked: [],
  warnings: [],
  ignoredPlays: 0,
  unmatchedTitles: [],
};

/**
 * Owner (user 1, Jellyfin account "owner-jf"), a friend (2, "friend-jf") and a user with no Jellyfin account (3). With
 * `metadata`, movies and series get their metadata from scripted sources, returned as `sources`.
 */
export async function connectorHarness(options: { metadata?: boolean } = {}) {
  const db = openTestDatabase();
  const scope = new AsyncUserScope();
  const repositories = createSqliteRepositories(db, scope);
  await repositories.users.create({ name: 'Friend', email: null });
  await repositories.users.create({ name: 'Nojelly', email: null });
  await repositories.settings.save(1, { ...NO_SETTINGS, jellyfinUser: 'owner-jf' });
  await repositories.settings.save(2, { ...NO_SETTINGS, jellyfinUser: 'friend-jf' });
  const sessions = new SessionService(repositories.sessions, repositories.users);
  const tokens = new ApiTokenService(repositories.apiTokens, repositories.users);
  const versions = new MemoryContentVersions();
  const sources = {
    movie: new ScriptedMetadataSource<Movie>({ overview: 'Plot' }),
    series: new ScriptedMetadataSource<Series>({ overview: 'Plot' }),
  };
  const metadata = options.metadata
    ? new MetadataCache(
        repositories.metadataStates,
        createImageStore(
          db,
          join(mkdtempSync(join(tmpdir(), 'metrack-connector-')), 'images'),
          fakeFetch({}).fetch,
        ),
      )
    : undefined;
  metadata?.register('movie', {
    repository: repositories.movies,
    source: sources.movie,
    lifecycle: movieLifecycle,
  });
  metadata?.register('series', {
    repository: repositories.series,
    source: sources.series,
    lifecycle: seriesLifecycle,
  });
  const targets = {
    movies: repositories.movies,
    series: repositories.series,
    seasons: repositories.seasons,
    overrides: repositories.overrides,
    unlinked: repositories.unlinked,
  };
  const app = buildTestApp({
    appVersion: 'test',
    migrationRunner: { currentVersion: async () => 1 },
    authenticator: new SessionCookieAuthenticator(sessions),
    scope,
    auth: { sessions, users: repositories.users, devLogin: true },
    tokens,
    contentVersions: versions,
    connector: new ConnectorService({
      users: repositories.users,
      settings: repositories.settings,
      targets,
      applier: new SyncApplier(repositories.transactions, targets),
      versions,
      alerts: repositories.releaseAlerts,
      scope,
      states: repositories.metadataStates,
      metadata,
    }),
  });
  const cookieFor = async (userId: number): Promise<string> => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { userId },
    });
    return String(response.headers['set-cookie']).split(';')[0] ?? '';
  };
  const createToken = async (userId: number, scope: TokenScope): Promise<CreatedToken> => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: { cookie: await cookieFor(userId) },
      payload: { name: scope, scope, expiresInDays: null },
    });
    if (response.statusCode !== 201) throw new Error(`Token not created: ${response.body}`);
    return response.json<CreatedToken>();
  };
  const call = (method: 'GET' | 'POST', url: string, secret: string, payload?: unknown) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${secret}` }, payload });
  const syncBody = (contentVersion: number, plan: Partial<SyncPlan>): ConnectorSyncRequest => ({
    contentVersion,
    plan: { ...EMPTY_PLAN, ...plan },
  });
  return {
    db,
    app,
    scope,
    repositories,
    versions,
    sources,
    cookieFor,
    createToken,
    call,
    syncBody,
  };
}
