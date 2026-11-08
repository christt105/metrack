import { Miniflare } from 'miniflare';
import type { R2Bucket } from '../../src/images/R2Bucket.js';

export interface LocalR2 {
  bucket: R2Bucket;
  dispose(): Promise<void>;
}

/** An empty R2 bucket served by Miniflare in memory; never reaches a Cloudflare account. */
export async function openLocalR2Bucket(): Promise<LocalR2> {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(null); } }',
    r2Buckets: ['IMAGES'],
  });
  const bucket = (await miniflare.getR2Bucket('IMAGES')) as unknown as R2Bucket;
  return { bucket, dispose: () => miniflare.dispose() };
}
