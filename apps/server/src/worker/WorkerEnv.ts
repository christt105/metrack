import type { Fetcher } from './Fetcher.js';
import type { R2Bucket } from '../images/R2Bucket.js';
import type { D1Database } from '../storage/d1/D1Database.js';

/** What the Worker is given: the D1 and R2 bindings, plus its variables and secrets as strings. */
export interface WorkerEnv {
  DB: D1Database;
  IMAGES: R2Bucket;
  ASSETS?: Fetcher;
  [name: string]: unknown;
}
