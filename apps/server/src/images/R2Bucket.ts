import type { R2Body } from './R2Body.js';

/** The part of a Cloudflare R2 bucket binding the image store uses; satisfied by `R2Bucket` and by Miniflare's. */
export interface R2Bucket {
  get(key: string): Promise<R2Body | null>;
  put(key: string, value: Uint8Array): Promise<unknown>;
  head(key: string): Promise<unknown>;
  delete(key: string): Promise<void>;
}
