import type { ImageBlobStore } from './ImageBlobStore.js';
import type { R2Bucket } from './R2Bucket.js';

/** Image files as objects of one R2 bucket; a `put` replaces the whole object or fails, so writes are atomic. */
export class R2ImageBlobStore implements ImageBlobStore {
  constructor(private readonly bucket: R2Bucket) {}

  async has(name: string): Promise<boolean> {
    return (await this.bucket.head(name)) !== null;
  }

  async read(name: string): Promise<Uint8Array> {
    const object = await this.bucket.get(name);
    if (!object) throw new Error(`Image file not found: ${name}`);
    return new Uint8Array(await object.arrayBuffer());
  }

  async write(name: string, bytes: Uint8Array): Promise<void> {
    await this.bucket.put(name, bytes);
  }

  async delete(name: string): Promise<void> {
    await this.bucket.delete(name);
  }
}
