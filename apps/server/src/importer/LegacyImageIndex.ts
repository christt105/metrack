import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { legacyImageName } from '@metrack/export';

/**
 * Finds the local copy of a remote image URL among directories written by the previous Hugo
 * migration script, which named each file after its source (see `legacyImageName`).
 */
export class LegacyImageIndex {
  private readonly byName = new Map<string, string>();

  constructor(dirs: string[]) {
    for (const dir of dirs) this.scan(dir);
  }

  /** Path of the local copy of `url`, or null when none of the directories has it. */
  find(url: string): string | null {
    return this.byName.get(legacyImageName(url)) ?? null;
  }

  private scan(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) this.scan(path);
      else if (!this.byName.has(entry)) this.byName.set(entry, path);
    }
  }
}
