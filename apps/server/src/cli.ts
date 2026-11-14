import { parseArgs } from 'node:util';
import { loadConfig } from './config/loadConfig.js';
import { buildRedirectPages } from '@metrack/export';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportSite } from './export/exportSite.js';
import { openExportSources } from './export/openExportSources.js';
import { runBackupCommand } from './backup/runBackupCommand.js';
import { loadSyncConfig } from './sync/loadSyncConfig.js';
import { runSyncCommand } from './sync/runSyncCommand.js';
import { runImport } from './importer/runImport.js';
import { formatMirrorResult } from './mirror/formatMirrorResult.js';
import { syncVaultMirror } from './mirror/syncVaultMirror.js';
import { runCatalogCommand } from './account/runCatalogCommand.js';
import { loadConnectorConfig } from './connector/loadConnectorConfig.js';
import { runConnector } from './connector/runConnector.js';
import { loadCloudBackupConfig } from './cloudbackup/loadCloudBackupConfig.js';
import { runCloudBackupCommand } from './cloudbackup/runCloudBackupCommand.js';
import { runConnectorCommand } from './connector/runConnectorCommand.js';
import { openJellystatPool } from './sync/jellystat/openJellystatPool.js';
import { createSyncSources } from './sync/createSyncSources.js';
import { TmdbClient } from './providers/tmdb/TmdbClient.js';
import { runUsersCommand } from './users/runUsersCommand.js';
import { OWNER_ID } from './users/OWNER_ID.js';
import { userDataPath } from './users/userDataPath.js';
import type { UserSettings } from '@metrack/domain';

const USAGE = `Usage: metrack export <outDir> [--data-dir <dir>]
       metrack redirect <outDir> --origin <newSiteAddress> [--old-base <path>]
       metrack backups [--data-dir <dir>]
       metrack backup [--data-dir <dir>]
       metrack restore <backupName> [--data-dir <dir>]
       metrack copies [--data-dir <dir>]
       metrack retrieve <backupName> [--data-dir <dir>]
       metrack sync [--apply] [--verbose] [--user <id>] [--data-dir <dir>]
       metrack connector [report|sync --user <id|name|jellyfinUser>] [--verbose] [--data-dir <dir>]
       metrack connector cloud-backup
       metrack connector restore-sql <database.db> [--out <file.sql>]
       metrack connector row-counts <database.db>
       metrack import <vaultMediaTrackerDir> [--apply] [--verbose] [--data-dir <dir>] [--images-dir <dir>]...
       metrack mirror <vaultMediaTrackerDir> [--apply] [--verbose] [--user <id>] [--data-dir <dir>] [--web-url <url>] [--link-prefix <path>]
       metrack users [add <name> [--email <address>]] [--data-dir <dir>]
       metrack users set <id> [--role trusted|normal] [--jellyfin-user <name>] [--ntfy-topic <topic>] [--publish-project <name>]
                     [--publish-base-url <url>] [--mirror-dir <dir>] [--mirror-link-prefix <path>]
                     [--handle <name>] [--public-page on|off] [--intro <text>] [--description <text>] [--data-dir <dir>]
       metrack users delete <id> [--cancel] [--data-dir <dir>]
       metrack users export <id> <file.zip> [--data-dir <dir>]
       metrack catalog [delete <movies|series|games|books> <id>] [--data-dir <dir>]

  Reads the Media Tracker notes. Without --apply it only prints a report and writes nothing.
  With --apply it writes to the database and image store in the data directory (DATA_DIR or ./data).
  --images-dir (repeatable) points at folders of images cached by the old Hugo site; remote cover and banner
  URLs are matched to files there by name and imported. Nothing is downloaded.

  sync compares the Jellyfin playback history (Jellyfin API plus the Jellystat database, configured with JELLYFIN_URL,
  JELLYFIN_TOKEN, JELLYSTAT_DB_HOST and JELLYSTAT_DB_PASSWORD) of the Jellyfin account in a user's settings with that
  user's tracking (--user, default 1). Without --apply it only prints the plan and the database is opened read-only.
  With --apply it writes the plan.

  connector is the home connector (docs/connector.md): it reads Jellyfin and Jellystat like sync, but reads each user's tracking
  from the cloud (METRACK_URL, METRACK_CONNECTOR_TOKEN) and sends only the changes. Alone it runs the long-lived service
  (webhook, queue, periodic pass); connector report prints one user's plan and writes nothing; connector sync computes and
  applies it once and exits. --user takes an id, a name or a Jellyfin account.

  connector cloud-backup copies the cloud data now (docs/connector.md, CLOUD_BACKUP_*); restore-sql turns a copied database into the SQL file
  that imports it into an empty D1, and row-counts prints the rows per table.

  redirect writes 404.html and index.html for the old GitHub Pages site. Every old address is sent to the same
  path on --origin (the old site was served under --old-base, default /MediaTracker). Nothing else is touched.

  backups lists stored backups, backup creates one now (and prunes to BACKUP_RETENTION), restore replaces the
  database and image store with a backup (stop the server first). When BACKUP_COPY_DIR is set, every backup is
  also copied there; copies lists the copied backups and retrieve rebuilds one of them under the backup folder so
  restore can use it.

  mirror writes one read-only note per item into the Media Tracker folder of the vault, with the names and
  folders the Obsidian plugin used, so the vault can link to them. Without --apply it only reports what would
  change. Properties the database does not hold (related, aliases...) and reviews that did not change are kept
  as written. --web-url (or VAULT_MIRROR_WEB_URL) adds a link back to the web app; --link-prefix is the
  folder's path inside the vault (default "Media Tracker").

  users lists who can sign in, their role and which background jobs run for each; users add creates a normal
  user, and users set --role makes one trusted (may add items by hand) or normal again; user 1 is the owner. User 1 owns
  everything stored before users existed. users set changes what a user's jobs act on (an empty value clears it):
  the Jellyfin account synced, the ntfy topic for release alerts and job failures, the Cloudflare Pages project and
  address of their site, and the vault folder their notes are mirrored into. A job runs only for users who set what
  it needs. --handle sets the name their public page is served under (/u/<handle>/; an empty value clears it) and
  --public-page on|off switches the page; it needs a handle. --intro and --description set the title and text of its header (an empty value clears them); the avatar, about text and comments are set in the web app. User 1's settings start from JELLYFIN_USER, NTFY_TOPIC, CLOUDFLARE_PAGES_PROJECT, PUBLISH_BASE_URL,
  VAULT_MIRROR_DIR and VAULT_MIRROR_LINK_PREFIX the first time the server starts; after that the stored ones win.

  users delete schedules the deletion of a user's account: it goes through the same 7 days of grace as when the user
  asks for it from the web, signing in cancels it, and --cancel withdraws it. The user is told through the ntfy topic
  in their settings (NTFY_URL must be set). The server erases the account once the grace period has passed; user 1
  cannot be deleted. users export writes the ZIP a user can download from Settings (their data as JSON and the
  images they own) to a file.

  catalog lists the items added by hand that no user has an entry for any more (they stay when their creator's account
  is deleted, passing to user 1), and catalog delete removes one of them.

  export writes the Hugo content tree (content/movies, tv, seasons, games, books with their images) into
  <outDir>, replacing those sections. It reads the database and image store in the data directory.`;

async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      apply: { type: 'boolean', default: false },
      cancel: { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
      'data-dir': { type: 'string' },
      'images-dir': { type: 'string', multiple: true },
      origin: { type: 'string' },
      'old-base': { type: 'string' },
      'web-url': { type: 'string' },
      'link-prefix': { type: 'string' },
      email: { type: 'string' },
      user: { type: 'string' },
      out: { type: 'string' },
      'jellyfin-user': { type: 'string' },
      'ntfy-topic': { type: 'string' },
      'publish-project': { type: 'string' },
      role: { type: 'string' },
      handle: { type: 'string' },
      'public-page': { type: 'string' },
      intro: { type: 'string' },
      description: { type: 'string' },
      'publish-base-url': { type: 'string' },
      'mirror-dir': { type: 'string' },
      'mirror-link-prefix': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [command, target] = positionals;
  const settingChanges = Object.fromEntries(
    (
      [
        ['jellyfinUser', values['jellyfin-user']],
        ['ntfyTopic', values['ntfy-topic']],
        ['publishProject', values['publish-project']],
        ['publishBaseUrl', values['publish-base-url']],
        ['mirrorDir', values['mirror-dir']],
        ['mirrorLinkPrefix', values['mirror-link-prefix']],
      ] as const
    ).filter(([, value]) => value !== undefined),
  ) as Partial<Record<keyof UserSettings, string>>;
  if (
    !values.help &&
    command === 'connector' &&
    (target === 'cloud-backup' || target === 'restore-sql' || target === 'row-counts')
  ) {
    const file = positionals[2];
    if (
      positionals.length > (target === 'cloud-backup' ? 2 : 3) ||
      (target !== 'cloud-backup' && !file)
    ) {
      console.error(USAGE);
      return 2;
    }
    const logger = { info: console.log, error: console.error };
    const { config, missing } = loadCloudBackupConfig(process.env);
    if (target === 'cloud-backup' && !config) {
      console.error(
        `The cloud backup is not configured${missing.length > 0 ? `, missing: ${missing.join(', ')}` : ' (CLOUD_BACKUP_DIR and the D1 variables)'}`,
      );
      return 2;
    }
    console.log(await runCloudBackupCommand(target, config, { file, out: values.out }, logger));
    return 0;
  }
  if (!values.help && command === 'connector') {
    const reporting = target === 'report';
    const syncing = target === 'sync';
    if (
      (target !== undefined && !reporting && !syncing) ||
      positionals.length > 2 ||
      ((reporting || syncing) && values.user === undefined) ||
      (target === undefined && values.user !== undefined)
    ) {
      console.error(USAGE);
      return 2;
    }
    const appConfig = loadConfig(process.env);
    const { config, missing } = loadConnectorConfig(
      { ...process.env, CONNECTOR_DATA_DIR: values['data-dir'] ?? process.env.CONNECTOR_DATA_DIR },
      appConfig.dataDir,
    );
    if (!config) {
      console.error(`The connector is not configured, missing: ${missing.join(', ')}`);
      return 2;
    }
    const tmdb = appConfig.tmdbApiKey
      ? new TmdbClient(fetch, { apiKey: appConfig.tmdbApiKey, language: appConfig.tmdbLanguage })
      : undefined;
    const logger = { info: console.log, error: console.error };
    const pool = openJellystatPool(config.sync.jellystat, logger);
    const sources = (jellyfinUser: string) =>
      createSyncSources(config.sync, jellyfinUser, pool, tmdb);
    if (target === undefined) {
      const stop = runConnector(config, appConfig, sources, logger, tmdb);
      const shutdown = (): void => {
        stop();
        void pool.end().finally(() => process.exit(0));
      };
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
      return new Promise<number>(() => undefined);
    }
    try {
      console.log(
        await runConnectorCommand(
          config,
          sources,
          { user: values.user!, apply: syncing, verbose: values.verbose },
          logger,
        ),
      );
    } finally {
      await pool.end();
    }
    return 0;
  }
  const userId = values.user === undefined ? OWNER_ID : Number(values.user);
  if (!Number.isInteger(userId) || userId < 1) {
    console.error(USAGE);
    return 2;
  }
  if (
    !values.help &&
    (command === 'backups' ||
      command === 'backup' ||
      command === 'restore' ||
      command === 'copies' ||
      command === 'retrieve')
  ) {
    if (positionals.length > (command === 'restore' || command === 'retrieve' ? 2 : 1)) {
      console.error(USAGE);
      return 2;
    }
    const env = { ...process.env, DATA_DIR: values['data-dir'] ?? process.env.DATA_DIR };
    console.log(await runBackupCommand(loadConfig(env), command, target));
    return 0;
  }
  if (!values.help && command === 'catalog') {
    const [, action, collection, id] = positionals;
    const deleting =
      action === 'delete' && positionals.length === 4 && Number.isInteger(Number(id));
    if ((action !== undefined && !deleting) || (action === undefined && positionals.length > 1)) {
      console.error(USAGE);
      return 2;
    }
    const dataDir = values['data-dir'] ?? loadConfig(process.env).dataDir;
    console.log(
      await runCatalogCommand({
        dataDir,
        delete: deleting ? { collection: collection!, id: Number(id) } : undefined,
      }),
    );
    return 0;
  }
  if (!values.help && command === 'users') {
    const [, action, name, file] = positionals;
    const adding = action === 'add' && name !== undefined && positionals.length === 3;
    const targetId = Number(name);
    const hasTarget = Number.isInteger(targetId) && targetId > 0;
    const setId = action === 'set' && positionals.length === 3 ? targetId : undefined;
    const setting = setId !== undefined && hasTarget;
    const deleting = action === 'delete' && positionals.length === 3 && hasTarget;
    const exporting = action === 'export' && positionals.length === 4 && hasTarget;
    const changesSettings = Object.keys(settingChanges).length > 0;
    if (
      (action !== undefined && !adding && !setting && !deleting && !exporting) ||
      (values.email !== undefined && !adding) ||
      (values.cancel && !deleting) ||
      ((changesSettings ||
        values.role !== undefined ||
        values.handle !== undefined ||
        values.intro !== undefined ||
        values.description !== undefined ||
        values['public-page'] !== undefined) &&
        !setting) ||
      (values['public-page'] !== undefined && !['on', 'off'].includes(values['public-page'])) ||
      values.user !== undefined
    ) {
      console.error(USAGE);
      return 2;
    }
    const dataDir = values['data-dir'] ?? loadConfig(process.env).dataDir;
    console.log(
      await runUsersCommand({
        dataDir,
        add: adding ? { name, email: values.email ?? null } : undefined,
        set: setting
          ? {
              userId: setId,
              changes: settingChanges,
              role: values.role,
              handle: values.handle,
              intro: values.intro,
              description: values.description,
              publicPage:
                values['public-page'] === undefined ? undefined : values['public-page'] === 'on',
            }
          : undefined,
        delete: deleting ? { userId: targetId, cancel: values.cancel } : undefined,
        exportTo: exporting ? { userId: targetId, file: file! } : undefined,
        ntfy: loadConfig(process.env).ntfyServer,
      }),
    );
    return 0;
  }
  if (!values.help && command === 'sync') {
    if (positionals.length > 1) {
      console.error(USAGE);
      return 2;
    }
    const { config: syncConfig, missing } = loadSyncConfig(process.env);
    if (!syncConfig) {
      console.error(`Jellyfin sync is not configured, missing: ${missing.join(', ')}`);
      return 2;
    }
    const appConfig = loadConfig(process.env);
    console.log(
      await runSyncCommand(syncConfig, {
        dataDir: values['data-dir'] ?? appConfig.dataDir,
        apply: values.apply,
        verbose: values.verbose,
        userId,
        tmdb: appConfig.tmdbApiKey
          ? { apiKey: appConfig.tmdbApiKey, language: appConfig.tmdbLanguage }
          : undefined,
      }),
    );
    return 0;
  }
  const known =
    command === 'import' || command === 'export' || command === 'redirect' || command === 'mirror';
  if (values.help || !known || !target || positionals.length > 2) {
    console.error(USAGE);
    return values.help ? 0 : 2;
  }
  if (command === 'redirect') {
    if (!values.origin) {
      console.error(USAGE);
      return 2;
    }
    const files = buildRedirectPages({ newOrigin: values.origin, oldBasePath: values['old-base'] });
    mkdirSync(target, { recursive: true });
    for (const file of files) writeFileSync(join(target, file.path), file.content);
    console.log(`Wrote ${files.map((file) => file.path).join(', ')} to ${target}`);
    return 0;
  }
  const config = loadConfig(process.env);
  if (command === 'export') {
    const { db, sources } = openExportSources(values['data-dir'] ?? config.dataDir);
    try {
      const result = await exportSite(sources, target);
      console.log(
        `Exported ${result.files} files to ${target} (fingerprint ${result.fingerprint})`,
      );
    } finally {
      db.close();
    }
    return 0;
  }
  if (command === 'mirror') {
    const dataDir = values['data-dir'] ?? config.dataDir;
    const { db, sources } = openExportSources(dataDir, userId);
    try {
      const result = await syncVaultMirror(sources, {
        mirrorDir: target,
        linkPrefix: values['link-prefix'] ?? 'Media Tracker',
        webUrl: values['web-url'] ?? process.env.VAULT_MIRROR_WEB_URL ?? null,
        statePath: userDataPath(dataDir, userId, 'vault-mirror-state.json'),
        apply: values.apply,
      });
      console.log(formatMirrorResult(result, values.apply, values.verbose));
    } finally {
      db.close();
    }
    return 0;
  }
  const output = await runImport({
    vaultDir: target,
    dataDir: values['data-dir'] ?? config.dataDir,
    imagesDirs: values['images-dir'] ?? [],
    apply: values.apply,
    verbose: values.verbose,
  });
  console.log(output);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
