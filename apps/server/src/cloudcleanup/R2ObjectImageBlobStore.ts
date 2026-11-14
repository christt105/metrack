import type { R2Client } from '../cloudbackup/R2Client.js';
import type { ImageBlobStore } from '../images/ImageBlobStore.js';

/** Image files as objects of an R2 bucket reached over its S3 API. It reads and deletes; it never writes. */
export class R2ObjectImageBlobStore implements ImageBlobStore {
  constructor(private readonly client: R2Client) {}

  has(name: string): Promise<boolean> {
    return this.client.has(name);
  }

  async read(name: string): Promise<Uint8Array> {
    return new Uint8Array(await this.client.get(name));
  }

  async write(name: string): Promise<void> {
    throw new Error(`The cloud image cleanup does not write images (${name})`);
  }

  delete(name: string): Promise<void> {
    return this.client.delete(name);
  }
}
