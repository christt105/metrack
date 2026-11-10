import type { DatabaseSync } from 'node:sqlite';
import type { FetchFn } from '../http/FetchFn.js';
import { SqliteImageRepository } from '../storage/sqlite/SqliteImageRepository.js';
import { DiskImageBlobStore } from './DiskImageBlobStore.js';
import { ImageStore } from './ImageStore.js';
import { PublicAddressGuard } from './PublicAddressGuard.js';
import { SharpImageEncoder } from './SharpImageEncoder.js';
import type { ImageStoreOptions } from './ImageStoreOptions.js';

/** An image store with its rows in SQLite and its files in a local directory. */
export function createImageStore(
  db: DatabaseSync,
  dir: string,
  fetchFn: FetchFn = fetch,
  now: () => Date = () => new Date(),
  options: ImageStoreOptions = {},
): ImageStore {
  return new ImageStore(new SqliteImageRepository(db), new DiskImageBlobStore(dir), fetchFn, now, {
    encoder: new SharpImageEncoder(),
    urlGuard: new PublicAddressGuard(),
    ...options,
  });
}
