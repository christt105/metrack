import { join } from 'node:path';
import { BackupJob } from '../../src/backup/BackupJob.js';
import { BackupService } from '../../src/backup/BackupService.js';
import type { Authenticator } from '../../src/auth/Authenticator.js';
import { SessionService } from '../../src/auth/SessionService.js';
import { MemoryContentVersions } from '../../src/site/MemoryContentVersions.js';
import { ConnectorService } from '../../src/sync/ConnectorService.js';
import { SyncApplier } from '../../src/sync/SyncApplier.js';
import { createSqliteRepositories } from '../../src/storage/sqlite/createSqliteRepositories.js';
import type { UserRepository } from '../../src/storage/repositories/UserRepository.js';
import { createSteamServices } from '../../src/steam/createSteamServices.js';
import { AsyncUserScope } from '../../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './createTestApi.js';
import { pathFetch } from './pathFetch.js';
import { png } from './sampleImages.js';

const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/original';

/**
 * The full API with the routes `createTestApi` leaves out (auth, backups, the connector, the ntfy topic) switched
 * on, signing each request in as the user named by its `x-test-user` header.
 */
export async function createIsolationApi(): Promise<{ api: TestApi; scope: AsyncUserScope }> {
  const scope = new AsyncUserScope();
  let users: UserRepository | undefined;
  const authenticator: Authenticator = {
    userFor: async (headers) => users?.get(Number(headers.get('x-test-user'))),
  };
  const api = await createTestApi(
    pathFetch({
      [`${TMDB}/movie/603`]: {
        id: 603,
        title: 'Matrix',
        original_title: 'The Matrix',
        release_date: '1999-03-31',
        poster_path: '/p.jpg',
        genres: [{ name: 'Action' }],
      },
      [`${TMDB}/search/movie`]: {
        results: [{ id: 603, title: 'Matrix', release_date: '1999-03-31' }],
      },
      [`${IMG}/p.jpg`]: png(500, 750, 1),
    }).fetch,
    {
      scope,
      authenticator,
      extend: ({ db, dir }) => {
        const repositories = createSqliteRepositories(db, scope);
        users = repositories.users;
        const targets = {
          movies: repositories.movies,
          series: repositories.series,
          seasons: repositories.seasons,
          unlinked: repositories.unlinked,
          episodeWatches: repositories.episodeWatches,
        };
        const logger = { info: () => {}, error: () => {} };
        const service = new BackupService(
          db,
          { dbPath: join(dir, 'metrack.db'), imagesDir: join(dir, 'images') },
          join(dir, 'backups'),
        );
        return {
          steamAchievements: createSteamServices(
            'steam-key',
            async () => new Response('{}', { status: 500 }),
            repositories.videogames,
            repositories.settings,
            undefined,
          ).achievements,
          auth: {
            sessions: new SessionService(repositories.sessions, repositories.users),
            users: repositories.users,
            devLogin: true,
          },
          connector: new ConnectorService({
            users: repositories.users,
            settings: repositories.settings,
            targets,
            applier: new SyncApplier(repositories.transactions, targets),
            versions: new MemoryContentVersions(),
            alerts: repositories.releaseAlerts,
            scope,
            states: repositories.metadataStates,
          }),
          backup: {
            service,
            job: new BackupJob(service, 5, { notify: async () => true }, logger),
          },
          settings: {
            users: repositories.users,
            settings: repositories.settings,
            profiles: repositories.profiles,
            generateNtfyTopic: () => 'isolation-topic',
          },
        };
      },
    },
  );
  return { api, scope };
}
