import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImageBlobStore } from './ImageBlobStore.js';

/** Image files in one local directory, written through a temporary file and a rename. */
export class DiskImageBlobStore implements ImageBlobStore {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  async has(name: string): Promise<boolean> {
    return existsSync(this.pathOf(name));
  }

  async read(name: string): Promise<Uint8Array> {
    return readFile(this.pathOf(name));
  }

  async write(name: string, bytes: Uint8Array): Promise<void> {
    const target = this.pathOf(name);
    const temp = `${target}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await writeFile(temp, bytes);
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  async delete(name: string): Promise<void> {
    await rm(this.pathOf(name), { force: true });
  }

  private pathOf(name: string): string {
    return join(this.dir, name);
  }
}
