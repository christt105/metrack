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
       metrack import <vaultMediaTrackerDir> [--apply] [--verbose] [--data-dir <dir>] [--images-dir <dir>]...
       metrack mirror <vaultMediaTrackerDir> [--apply] [--verbose] [--user <id>] [--data-dir <dir>] [--web-url <url>] [--link-prefix <path>]
       metrack users [add <name> [--email <address>]] [--data-dir <dir>]
       metrack users set <id> [--role trusted|normal] [--jellyfin-user <name>] [--ntfy-topic <topic>] [--publish-project <name>]
                     [--publish-base-url <url>] [--mirror-dir <dir>] [--mirror-link-prefix <path>]
                     [--handle <name>] [--public-page on|off] [--data-dir <dir>]

  Reads the Media Tracker notes. Without --apply it only prints a report and writes nothing.
  With --apply it writes to the database and image store in the data directory (DATA_DIR or ./data).
  --images-dir (repeatable) points at folders of images cached by the old Hugo site; remote cover and banner
  URLs are matched to files there by name and imported. Nothing is downloaded.

  sync compares the Jellyfin playback history (Jellyfin API plus the Jellystat database, configured with JELLYFIN_URL,
  JELLYFIN_TOKEN, JELLYSTAT_DB_HOST and JELLYSTAT_DB_PASSWORD) of the Jellyfin account in a user's settings with that
  user's tracking (--user, default 1). Without --apply it only prints the plan and the database is opened read-only.
  With --apply it writes the plan.

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
  --public-page on|off switches the page; it needs a handle. User 1's settings start from JELLYFIN_USER, NTFY_TOPIC, CLOUDFLARE_PAGES_PROJECT, PUBLISH_BASE_URL,
  VAULT_MIRROR_DIR and VAULT_MIRROR_LINK_PREFIX the first time the server starts; after that the stored ones win.

  export writes the Hugo content tree (content/movies, tv, seasons, games, books with their images) into
  <outDir>, replacing those sections. It reads the database and image store in the data directory.`;

async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      apply: { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
      'data-dir': { type: 'string' },
      'images-dir': { type: 'string', multiple: true },
      origin: { type: 'string' },
      'old-base': { type: 'string' },
      'web-url': { type: 'string' },
      'link-prefix': { type: 'string' },
      email: { type: 'string' },
      user: { type: 'string' },
      'jellyfin-user': { type: 'string' },
      'ntfy-topic': { type: 'string' },
      'publish-project': { type: 'string' },
      role: { type: 'string' },
      handle: { type: 'string' },
      'public-page': { type: 'string' },
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
  if (!values.help && command === 'users') {
    const [, action, name] = positionals;
    const adding = action === 'add' && name !== undefined && positionals.length === 3;
    const setId = action === 'set' && positionals.length === 3 ? Number(name) : undefined;
    const setting = setId !== undefined && Number.isInteger(setId) && setId > 0;
    const changesSettings = Object.keys(settingChanges).length > 0;
    if (
      (action !== undefined && !adding && !setting) ||
      (values.email !== undefined && !adding) ||
      ((changesSettings ||
        values.role !== undefined ||
        values.handle !== undefined ||
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
              publicPage:
                values['public-page'] === undefined ? undefined : values['public-page'] === 'on',
            }
          : undefined,
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
