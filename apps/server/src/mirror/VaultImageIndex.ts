import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IMAGE_FILE = /\.(png|jpe?g|webp|gif|avif)$/i;

/** The images already in the vault folders the mirror links to, by content hash. */
export class VaultImageIndex {
  private readonly byHash = new Map<string, string>();
  private readonly byPath = new Map<string, string>();

  /**
   * @param mirrorDir the Media Tracker folder on disk.
   * @param linkPrefix that folder's path inside the vault, used to build `[[...]]` links.
   * @param folders sub-folders of `mirrorDir` holding images.
   */
  constructor(
    mirrorDir: string,
    private readonly linkPrefix: string,
    folders: readonly string[],
  ) {
    for (const folder of folders) {
      const dir = join(mirrorDir, folder);
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir).sort()) {
        if (!IMAGE_FILE.test(name) || !statSync(join(dir, name)).isFile()) continue;
        this.add(`${folder}/${name}`, readFileSync(join(dir, name)));
      }
    }
  }

  /** Records a file the mirror has just placed in the vault. */
  add(relativePath: string, bytes: Uint8Array): void {
    const hash = createHash('sha256').update(bytes).digest('hex');
    const link = `${this.linkPrefix}/${relativePath}`;
    if (!this.byHash.has(hash)) this.byHash.set(hash, link);
    this.byPath.set(link, hash);
  }

  /** The vault path of a file with these bytes, if there is one. */
  linkOf(hash: string): string | null {
    return this.byHash.get(hash) ?? null;
  }

  /** The hash of the file a vault path or `[[link]]` names, if it is one of the indexed files. */
  hashOf(link: string): string | null {
    const path =
      link
        .replace(/^\[\[|\]\]$/g, '')
        .split('|')[0]
        ?.trim() ?? '';
    return this.byPath.get(path) ?? null;
  }
}
