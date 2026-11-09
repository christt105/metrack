import type { StorageHarness } from './StorageHarness.js';

/** A storage implementation the repository tests run against. */
export interface StorageBackend {
  name: string;
  open(): Promise<StorageHarness>;
  dispose(): Promise<void>;
}
