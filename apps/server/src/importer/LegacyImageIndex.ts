import { readdirSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { legacyImageName } from '@metrack/export';

/**
 * Finds the local copy of a remote image URL among directories written by the previous Hugo
 * migration script, which named each file after its source (see `legacyImageName`). Symbolic
 * links are followed, but each real directory is scanned once, so link cycles terminate.
 */
export class LegacyImageIndex {
  private readonly byName = new Map<string, string>();
  private readonly visited = new Set<string>();

  constructor(dirs: string[]) {
    for (const dir of dirs) this.scan(dir);
  }

  /** Path of the local copy of `url`, or null when none of the directories has it. */
  find(url: string): string | null {
    return this.byName.get(legacyImageName(url)) ?? null;
  }

  private scan(dir: string): void {
    const real = realpathSync(dir);
    if (this.visited.has(real)) return;
    this.visited.add(real);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const target = entry.isSymbolicLink() ? statSync(path, { throwIfNoEntry: false }) : entry;
      if (target === undefined) continue;
      if (target.isDirectory()) this.scan(path);
      else if (!this.byName.has(entry.name)) this.byName.set(entry.name, path);
    }
  }
}
