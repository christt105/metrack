import { parseArgs } from 'node:util';
import { loadConfig } from './config/loadConfig.js';
import { runImport } from './importer/runImport.js';

const USAGE = `Usage: metrack import <vaultMediaTrackerDir> [--apply] [--verbose] [--data-dir <dir>] [--images-dir <dir>]...

  Reads the Media Tracker notes. Without --apply it only prints a report and writes nothing.
  With --apply it writes to the database and image store in the data directory (DATA_DIR or ./data).
  --images-dir (repeatable) points at folders of images cached by the old Hugo site; remote cover and banner
  URLs are matched to files there by name and imported. Nothing is downloaded.`;

async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      apply: { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
      'data-dir': { type: 'string' },
      'images-dir': { type: 'string', multiple: true },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [command, vaultDir] = positionals;
  if (values.help || command !== 'import' || !vaultDir || positionals.length > 2) {
    console.error(USAGE);
    return values.help ? 0 : 2;
  }
  const config = loadConfig(process.env);
  const output = await runImport({
    vaultDir,
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
