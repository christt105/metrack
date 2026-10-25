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

const USAGE = `Usage: metrack export <outDir> [--data-dir <dir>]
       metrack redirect <outDir> --origin <newSiteAddress> [--old-base <path>]
       metrack backups [--data-dir <dir>]
       metrack backup [--data-dir <dir>]
       metrack restore <backupName> [--data-dir <dir>]
       metrack sync [--apply] [--verbose] [--data-dir <dir>]
       metrack import <vaultMediaTrackerDir> [--apply] [--verbose] [--data-dir <dir>] [--images-dir <dir>]...

  Reads the Media Tracker notes. Without --apply it only prints a report and writes nothing.
  With --apply it writes to the database and image store in the data directory (DATA_DIR or ./data).
  --images-dir (repeatable) points at folders of images cached by the old Hugo site; remote cover and banner
  URLs are matched to files there by name and imported. Nothing is downloaded.

  sync compares the Jellyfin playback history (Jellyfin API plus the Jellystat database, configured with JELLYFIN_URL,
  JELLYFIN_TOKEN, JELLYSTAT_DB_HOST, JELLYSTAT_DB_PASSWORD and optionally JELLYFIN_USER, default admin) with the
  tracking in the data directory. Without --apply it only prints the plan and the database is opened read-only.
  With --apply it writes the plan.

  redirect writes 404.html and index.html for the old GitHub Pages site. Every old address is sent to the same
  path on --origin (the old site was served under --old-base, default /MediaTracker). Nothing else is touched.

  backups lists stored backups, backup creates one now (and prunes to BACKUP_RETENTION), restore replaces the
  database and image store with a backup (stop the server first).

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
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [command, target] = positionals;
  if (!values.help && (command === 'backups' || command === 'backup' || command === 'restore')) {
    if (positionals.length > (command === 'restore' ? 2 : 1)) {
      console.error(USAGE);
      return 2;
    }
    const env = { ...process.env, DATA_DIR: values['data-dir'] ?? process.env.DATA_DIR };
    console.log(await runBackupCommand(loadConfig(env), command, target));
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
    console.log(
      await runSyncCommand(syncConfig, {
        dataDir: values['data-dir'] ?? loadConfig(process.env).dataDir,
        apply: values.apply,
        verbose: values.verbose,
      }),
    );
    return 0;
  }
  const known = command === 'import' || command === 'export' || command === 'redirect';
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
      const result = exportSite(sources, target);
      console.log(
        `Exported ${result.files} files to ${target} (fingerprint ${result.fingerprint})`,
      );
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
