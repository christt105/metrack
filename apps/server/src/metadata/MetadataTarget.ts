import type { Lifecycle } from './Lifecycle.js';
import type { MetadataSource } from './MetadataSource.js';

export interface MetadataTarget<T extends { id: number }> {
  repository: {
    get(id: number): Promise<T | undefined>;
    updateCatalog(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T>;
  };
  source: MetadataSource<T>;
  lifecycle(entity: T): Lifecycle;
}
