import { parseArgs } from 'node:util';
import { loadConfig } from './config/loadConfig.js';
import { buildRedirectPages } from '@metrack/export';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportSite } from './export/exportSite.js';
import { openExportSources } from './export/openExportSources.js';
import { runImport } from './importer/runImport.js';

const USAGE = `Usage: metrack export <outDir> [--data-dir <dir>]
       metrack redirect <outDir> --origin <newSiteAddress> [--old-base <path>]
       metrack import <vaultMediaTrackerDir> [--apply] [--verbose] [--data-dir <dir>] [--images-dir <dir>]...

  Reads the Media Tracker notes. Without --apply it only prints a report and writes nothing.
  With --apply it writes to the database and image store in the data directory (DATA_DIR or ./data).
  --images-dir (repeatable) points at folders of images cached by the old Hugo site; remote cover and banner
  URLs are matched to files there by name and imported. Nothing is downloaded.

  redirect writes 404.html and index.html for the old GitHub Pages site. Every old address is sent to the same
  path on --origin (the old site was served under --old-base, default /MediaTracker). Nothing else is touched.

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
