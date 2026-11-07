import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@metrack/domain';
import { ReleaseWatcher } from '../src/alerts/ReleaseWatcher.js';
import { UserReleaseWatchers } from '../src/alerts/UserReleaseWatchers.js';
import { buildApp } from '../src/api/buildApp.js';
import type { Authenticator } from '../src/auth/Authenticator.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import { createImageStore } from '../src/images/createImageStore.js';
import { emptyMovie, emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import { createUserMirrorQueues } from '../src/mirror/createUserMirrorQueues.js';
import { UserNotifier } from '../src/notify/UserNotifier.js';
import type { CommandRunner } from '../src/publish/CommandRunner.js';
import { createUserPublishQueues } from '../src/publish/createUserPublishQueues.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { createSqliteRepositories } from '../src/storage/sqlite/createSqliteRepositories.js';
import type { SqliteRepositories } from '../src/storage/sqlite/SqliteRepositories.js';
import { createUserSyncQueues } from '../src/sync/createUserSyncQueues.js';
import type { LibrarySource } from '../src/sync/LibrarySource.js';
import type { PlaybackSource } from '../src/sync/PlaybackSource.js';
import { SyncApplier } from '../src/sync/SyncApplier.js';
import { SyncService } from '../src/sync/SyncService.js';
import { UserSyncServices } from '../src/sync/UserSyncServices.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { NO_SETTINGS } from '../src/users/NO_SETTINGS.js';
import { OWNER_ID } from '../src/users/OWNER_ID.js';
import { seedOwnerSettings } from '../src/users/seedOwnerSettings.js';
import { userDataPath } from '../src/users/userDataPath.js';
import { UserJobContext } from '../src/users/UserJobContext.js';
import type { UserSettings } from '@metrack/domain';
import { FakeReleaseSource } from './support/FakeReleaseSource.js';
import { FakeScheduler } from './support/FakeScheduler.js';
import { RecordingNotifier } from './support/RecordingNotifier.js';

const FRIEND_ID = 2;
const STRANGER_ID = 3;
const USERS: User[] = [
  { id: OWNER_ID, name: 'Owner', email: null, role: 'owner' },
  { id: FRIEND_ID, name: 'Friend', email: null, role: 'normal' },
  { id: STRANGER_ID, name: 'Stranger', email: null, role: 'normal' },
];

/** Signs each request in as the user named by the `x-test-user` header. */
const byHeader: Authenticator = {
  userFor: async (headers) => USERS.find((user) => user.id === Number(headers['x-test-user'])),
};

const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'metrack-jobs-'));
  created.push(dir);
  return dir;
}

let db: DatabaseSync;
let dataDir: string;
let scope: AsyncUserScope;
let repos: SqliteRepositories;
let timer: FakeScheduler;
let logs: string[];
let jobs: UserJobContext;

beforeEach(async () => {
  dataDir = tempDir();
  const { openDatabase } = await import('../src/storage/sqlite/openDatabase.js');
  db = openDatabase(join(dataDir, 'metrack.db'));
  new MigrationRunner(db, migrations).run();
  scope = new AsyncUserScope();
  repos = createSqliteRepositories(db, scope);
  await repos.users.create({ name: 'Friend', email: null });
  await repos.users.create({ name: 'Stranger', email: null });
  timer = new FakeScheduler();
  logs = [];
  jobs = new UserJobContext({
    timer,
    scope,
    settings: repos.settings,
    ntfy: undefined,
    logger: { info: (m) => void logs.push(m), error: (m) => void logs.push(m) },
  });
});

async function configure(userId: number, settings: Partial<UserSettings>): Promise<void> {
  await repos.settings.save(userId, { ...NO_SETTINGS, ...settings });
}

const as = <T>(userId: number, work: () => Promise<T>): Promise<T> => scope.run(userId, work);

function entriesByUser(table: string): Record<number, number> {
  return Object.fromEntries(
    db
      .prepare(`SELECT user_id, COUNT(*) AS n FROM ${table} GROUP BY user_id`)
      .all()
      .map((row) => [Number(row.user_id), Number(row.n)]),
  );
}

async function fireAll(): Promise<void> {
  while (timer.pending() > 0) await timer.fire();
}

async function addMovie(userId: number, title: string, tmdbId: number): Promise<number> {
  return (
    await as(userId, () =>
      repos.movies.create({
        ...emptyMovie(),
        tmdbId,
        title,
        status: 'completed',
        finishedAt: '2026-10-01',
      }),
    )
  ).id;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile());
}

function textUnder(dir: string): string {
  return filesUnder(dir)
    .filter((path) => path.endsWith('.md'))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
}

describe('per-user Jellyfin sync', () => {
  const library: LibrarySource = {
    load: async () => ({
      movies: [
        { jellyfinId: 'm1', title: 'Matrix', year: 1999, tmdbId: 603, runtimeSeconds: 6000 },
        { jellyfinId: 'm2', title: 'Heat', year: 1995, tmdbId: 949, runtimeSeconds: 6000 },
      ],
      series: [],
    }),
  };
  const playsOf: Record<string, PlaybackSource> = {
    admin: {
      listPlays: async () => [
        { itemId: 'm1', playedAt: '2026-10-20T20:00:00Z', watchedSeconds: 6000 },
      ],
    },
    haku: {
      listPlays: async () => [
        { itemId: 'm2', playedAt: '2026-10-21T20:00:00Z', watchedSeconds: 6000 },
      ],
    },
  };
  const readAccounts: string[] = [];

  function services(): UserSyncServices {
    return new UserSyncServices(repos.settings, (jellyfinUser) => {
      readAccounts.push(jellyfinUser);
      const plays = playsOf[jellyfinUser];
      if (!plays) throw new Error(`unknown account ${jellyfinUser}`);
      return new SyncService(library, plays, repos, new SyncApplier(repos.transactions, repos), {
        timeZone: 'Europe/Madrid',
        now: () => new Date('2026-10-25T12:00:00Z'),
      });
    });
  }

  async function app(sync: UserSyncServices) {
    return buildApp({
      appVersion: 'test',
      authenticator: byHeader,
      scope,
      migrationRunner: new MigrationRunner(db, migrations),
      sync,
      syncQueues: createUserSyncQueues(sync, jobs, 120_000, []),
    });
  }

  beforeEach(async () => {
    readAccounts.length = 0;
    await configure(OWNER_ID, { jellyfinUser: 'admin' });
    await configure(FRIEND_ID, { jellyfinUser: 'haku' });
  });

  it('syncs every user with a Jellyfin account from the webhook, each into their own entries', async () => {
    const friendMatrix = await addMovie(FRIEND_ID, 'Matrix', 603);
    await as(FRIEND_ID, () => repos.movies.update(friendMatrix, { status: 'planned' }));
    const api = await app(services());

    const response = await api.inject({ method: 'POST', url: '/api/sync/webhook', payload: {} });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ status: 'queued', users: 2 });
    expect(timer.delays).toEqual([120_000, 120_000]);
    await fireAll();

    expect(readAccounts.sort()).toEqual(['admin', 'haku']);
    const titles = async (userId: number) =>
      (await as(userId, () => repos.movies.list())).map((m) => `${m.title}:${m.status}`).sort();
    expect(await titles(OWNER_ID)).toEqual(['Matrix:completed']);
    expect(await titles(FRIEND_ID)).toEqual(['Heat:completed', 'Matrix:planned']);
    expect(await titles(STRANGER_ID)).toEqual([]);
    expect(entriesByUser('movie_entry')).toEqual({ [OWNER_ID]: 1, [FRIEND_ID]: 2 });
    expect(logs.some((m) => m.startsWith('[user 2] Jellyfin sync'))).toBe(true);
  });

  it('reports and applies with the signed-in user account, and never with another one', async () => {
    const api = await app(services());
    const report = (user: number) =>
      api.inject({ method: 'GET', url: '/api/sync/report', headers: { 'x-test-user': `${user}` } });

    expect((await report(FRIEND_ID)).json().movies).toMatchObject([{ title: 'Heat' }]);
    expect(readAccounts).toEqual(['haku']);
    const refused = await report(STRANGER_ID);
    expect(refused.statusCode).toBe(501);
    expect(refused.json().code).toBe('sync_not_configured');
    const apply = await api.inject({
      method: 'POST',
      url: '/api/sync/apply',
      headers: { 'x-test-user': `${STRANGER_ID}` },
      payload: { confirm: true },
    });
    expect(apply.statusCode).toBe(501);
    expect(readAccounts).toEqual(['haku']);
    expect(entriesByUser('movie_entry')).toEqual({});
  });

  it('skips a queued run when the account was removed before it ran', async () => {
    const api = await app(services());
    await api.inject({ method: 'POST', url: '/api/sync/webhook', payload: {} });
    await configure(FRIEND_ID, {});
    await fireAll();
    expect(readAccounts).toEqual(['admin']);
    expect(logs).toContain('[user 2] Jellyfin sync skipped, no Jellyfin user is set');
  });
});

describe('per-user publishing', () => {
  it('builds each site from its own data and uploads it to its own project', async () => {
    await addMovie(OWNER_ID, 'Owner Film', 1);
    await addMovie(FRIEND_ID, 'Friend Film', 2);
    await configure(OWNER_ID, { publishProject: 'owner-site', publishBaseUrl: 'https://o.dev/' });
    await configure(FRIEND_ID, { publishProject: 'friend-site' });
    const template = tempDir();
    mkdirSync(join(template, 'layouts'));
    const built: Record<string, string> = {};
    const uploads: string[][] = [];
    const runner: CommandRunner = {
      run: async (command, args, options) => {
        if (command === 'hugo') built[args.join(' ')] = textUnder(options?.cwd ?? '');
        else uploads.push(args);
      },
    };
    const queues = createUserPublishQueues({
      config: {
        siteTemplateDir: template,
        hugoBinary: 'hugo',
        wranglerBinary: 'wrangler',
        cloudflareApiToken: 'token',
        cloudflareAccountId: 'account',
        cloudflareBranch: 'main',
      },
      sources: { ...repos, images: createImageStore(db, join(dataDir, 'images')) },
      dataDir,
      runner,
      jobs,
    });

    expect(await queues.markAllDirty()).toBe(2);
    expect(await queues.markDirty(STRANGER_ID)).toBe(false);
    await fireAll();
    await vi.waitFor(() => expect(uploads).toHaveLength(2));

    const ownerBuild = `--minify --destination ${join(dataDir, 'publish', 'public')} --baseURL https://o.dev/`;
    const friendBuild = `--minify --destination ${join(dataDir, 'users', '2', 'publish', 'public')}`;
    expect(Object.keys(built).sort()).toEqual([ownerBuild, friendBuild].sort());
    expect(built[ownerBuild]).toContain('Owner Film');
    expect(built[ownerBuild]).not.toContain('Friend Film');
    expect(built[friendBuild]).toContain('Friend Film');
    expect(built[friendBuild]).not.toContain('Owner Film');
    expect(uploads.map((args) => args[args.indexOf('--project-name') + 1]).sort()).toEqual([
      'friend-site',
      'owner-site',
    ]);
    expect(statSync(join(dataDir, 'publish-state.json')).isFile()).toBe(true);
    expect(statSync(join(dataDir, 'users', '2', 'publish-state.json')).isFile()).toBe(true);
  });
});

describe('per-user vault mirror', () => {
  it('mirrors each user notes into their own folder only', async () => {
    await addMovie(OWNER_ID, 'Owner Film', 1);
    await addMovie(FRIEND_ID, 'Friend Film', 2);
    const ownerVault = tempDir();
    const friendVault = tempDir();
    await configure(OWNER_ID, { mirrorDir: ownerVault });
    await configure(FRIEND_ID, { mirrorDir: friendVault, mirrorLinkPrefix: 'Pelis' });
    const queues = createUserMirrorQueues({
      sources: { ...repos, images: createImageStore(db, join(dataDir, 'images')) },
      dataDir,
      webUrl: null,
      jobs,
    });

    expect(await queues.markAllDirty()).toBe(2);
    await fireAll();
    await vi.waitFor(() => expect(logs.filter((m) => m.includes('Vault mirror'))).toHaveLength(2));

    expect(textUnder(ownerVault)).toContain('Owner Film');
    expect(textUnder(ownerVault)).not.toContain('Friend Film');
    expect(textUnder(friendVault)).toContain('Friend Film');
    expect(textUnder(friendVault)).not.toContain('Owner Film');
    expect(readFileSync(join(dataDir, 'vault-mirror-state.json'), 'utf8')).not.toContain(
      friendVault,
    );
    expect(
      readFileSync(join(dataDir, 'users', '2', 'vault-mirror-state.json'), 'utf8'),
    ).not.toContain(ownerVault);
  });
});

describe('per-user release alerts', () => {
  it('watches each user followed titles and alerts only them', async () => {
    const source = new FakeReleaseSource();
    const release = (name: string) => ({
      posterUrl: null,
      numberOfSeasons: 2,
      seasons: [
        { number: 1, name, overview: null, airDate: '2021-01-08', episodeCount: 5 },
        { number: 2, name, overview: null, airDate: '2026-10-23', episodeCount: 8 },
      ],
      nextEpisode: { seasonNumber: 2, episodeNumber: 1, airDate: '2026-10-23' },
      flatrateEs: false,
    });
    source.seriesById.set(10, release('Lupin'));
    source.seriesById.set(20, release('Arcane'));
    const follow = async (userId: number, tmdbId: number, title: string, followed: boolean) => {
      const series = await as(userId, () =>
        repos.series.create({ ...emptySeries(), tmdbId, title, follow: followed }),
      );
      await as(userId, () =>
        repos.seasons.create({
          ...emptySeason(),
          seriesId: series.id,
          number: 1,
          tmdbSeasonNumber: 1,
          firstAirDate: '2021-01-08',
        }),
      );
      return series.id;
    };
    const lupin = await follow(OWNER_ID, 10, 'Lupin', true);
    await follow(FRIEND_ID, 10, 'Lupin', false);
    await follow(FRIEND_ID, 20, 'Arcane', true);
    await configure(OWNER_ID, { ntfyTopic: 'owner' });
    await configure(FRIEND_ID, { ntfyTopic: 'friend' });
    await configure(STRANGER_ID, {});
    const notifiers = new Map<number, RecordingNotifier>();
    const watchers = new UserReleaseWatchers(
      () => jobs.usersWith((settings) => settings.ntfyTopic),
      (userId) => {
        const notifier = new RecordingNotifier();
        notifiers.set(userId, notifier);
        return new ReleaseWatcher({
          ...repos,
          alerts: repos.releaseAlerts,
          source,
          notifier,
          logger: jobs.logger(userId),
          timeZone: 'Europe/Madrid',
          notifyFromHour: 8,
          now: () => new Date('2026-10-22T09:00:00Z'),
        });
      },
      scope,
      jobs.logger(0),
    );

    await watchers.tick();

    expect([...notifiers.keys()]).toEqual([OWNER_ID, FRIEND_ID]);
    expect(notifiers.get(OWNER_ID)?.sent.map((n) => n.title)).toEqual(['Lupin, season 2']);
    expect(notifiers.get(FRIEND_ID)?.sent.map((n) => n.title)).toEqual(['Arcane, season 2']);
    expect(entriesByUser('release_alert')).toEqual({ [OWNER_ID]: 1, [FRIEND_ID]: 1 });
    const friendLupin = await as(FRIEND_ID, () => repos.series.list());
    const friendLupinId = friendLupin.find((s) => s.title === 'Lupin')?.id ?? -1;
    expect(friendLupinId).toBe(lupin);
    expect(
      (await as(FRIEND_ID, () => repos.seasons.listBySeries(lupin))).map((s) => s.number),
    ).toEqual([1]);
    expect(
      (await as(OWNER_ID, () => repos.seasons.listBySeries(lupin))).map((s) => s.number),
    ).toEqual([1, 2]);
  });

  it('keeps watching the other users when one fails', async () => {
    const errors: string[] = [];
    const ran: number[] = [];
    const watchers = new UserReleaseWatchers(
      async () => [OWNER_ID, FRIEND_ID],
      (userId) =>
        ({
          tick: async () => {
            ran.push(scope.userId());
            if (userId === OWNER_ID) throw new Error('boom');
          },
        }) as unknown as ReleaseWatcher,
      scope,
      { info: () => {}, error: (m) => void errors.push(m) },
    );
    await watchers.tick();
    expect(ran).toEqual([OWNER_ID, FRIEND_ID]);
    expect(errors).toEqual(['release watcher failed for user 1: boom']);
  });
});

describe('UserNotifier', () => {
  it('sends to the topic the user has set, and only logs without one', async () => {
    const bodies: unknown[] = [];
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}');
    }) as FetchFn;
    const logged: string[] = [];
    const logger = { info: () => {}, error: (m: string) => void logged.push(m) };
    const server = { url: 'http://ntfy', token: 'k' };
    await configure(FRIEND_ID, { ntfyTopic: 'friend' });

    expect(
      await new UserNotifier(repos.settings, FRIEND_ID, server, logger, fetchFn).notify('T', 'M'),
    ).toBe(true);
    expect(bodies).toMatchObject([{ topic: 'friend', title: 'T' }]);
    expect(
      await new UserNotifier(repos.settings, STRANGER_ID, server, logger, fetchFn).notify('T', 'M'),
    ).toBe(true);
    expect(bodies).toHaveLength(1);
    expect(logged).toEqual(['[alert] T: M']);
  });
});

describe('owner settings from the environment', () => {
  const env = {
    JELLYFIN_URL: 'http://jf',
    JELLYFIN_TOKEN: 't',
    JELLYSTAT_DB_HOST: 'db',
    JELLYSTAT_DB_PASSWORD: 'p',
    NTFY_URL: 'http://ntfy',
    NTFY_TOPIC: 'metrack',
    CLOUDFLARE_PAGES_PROJECT: 'media-tracker',
    PUBLISH_BASE_URL: 'https://media-tracker.pages.dev/',
  };

  it('are stored the first time, with the default Jellyfin account when sync is configured', async () => {
    const logger = { info: (m: string) => void logs.push(m), error: () => {} };
    await seedOwnerSettings(repos.settings, env, logger);
    expect(await repos.settings.get(OWNER_ID)).toEqual({
      jellyfinUser: 'admin',
      ntfyTopic: 'metrack',
      publishProject: 'media-tracker',
      publishBaseUrl: 'https://media-tracker.pages.dev/',
      mirrorDir: null,
      mirrorLinkPrefix: null,
    });
    expect(await repos.settings.get(FRIEND_ID)).toBeUndefined();
  });

  it('then lose to the stored ones, and a disagreeing variable is only reported', async () => {
    const logger = { info: (m: string) => void logs.push(m), error: () => {} };
    await seedOwnerSettings(repos.settings, env, logger);
    await configure(OWNER_ID, { ...(await repos.settings.get(OWNER_ID)), ntfyTopic: 'mine' });
    logs.length = 0;
    await seedOwnerSettings(repos.settings, { ...env, VAULT_MIRROR_DIR: '/vault' }, logger);
    expect(await repos.settings.get(OWNER_ID)).toMatchObject({
      ntfyTopic: 'mine',
      mirrorDir: null,
    });
    expect(logs).toHaveLength(2);
    expect(logs[0]).toContain('NTFY_TOPIC is ignored');
    expect(logs[1]).toContain('VAULT_MIRROR_DIR is ignored');
  });

  it('leave the Jellyfin account empty when sync is not configured', async () => {
    await seedOwnerSettings(repos.settings, {}, { info: () => {}, error: () => {} });
    expect(await repos.settings.get(OWNER_ID)).toEqual(NO_SETTINGS);
  });
});

describe('userDataPath', () => {
  it('keeps the owner paths from before users and gives everyone else a folder', () => {
    expect(userDataPath('/data', OWNER_ID, 'publish-state.json')).toBe('/data/publish-state.json');
    expect(userDataPath('/data', 7, 'publish-state.json')).toBe('/data/users/7/publish-state.json');
  });
});
