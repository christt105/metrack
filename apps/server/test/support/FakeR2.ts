import { R2Client } from '../../src/cloudbackup/R2Client.js';
import type { R2Object } from '../../src/cloudbackup/R2Object.js';

/** A bucket held in memory that counts the objects fetched. */
export class FakeR2 extends R2Client {
  readonly fetched: string[] = [];
  readonly objects = new Map<string, Buffer>();
  /** Keys whose download returns the wrong number of bytes. */
  readonly corrupt = new Set<string>();

  constructor() {
    super({ bucket: 'b', accessKeyId: 'a', secretAccessKey: 's', endpoint: 'http://r2.test' });
  }

  put(key: string, body = key): void {
    this.objects.set(key, Buffer.from(body));
  }

  override async list(): Promise<R2Object[]> {
    return [...this.objects].map(([key, body]) => ({ key, size: body.length }));
  }

  override async get(key: string): Promise<Buffer> {
    this.fetched.push(key);
    const body = this.objects.get(key)!;
    return this.corrupt.has(key) ? body.subarray(1) : body;
  }
}
