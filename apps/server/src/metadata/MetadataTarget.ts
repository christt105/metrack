import type { Lifecycle } from './Lifecycle.js';
import type { MetadataSource } from './MetadataSource.js';

export interface MetadataTarget<T extends { id: number }> {
  repository: {
    get(id: number): T | undefined;
    update(id: number, patch: Partial<Omit<T, 'id'>>): T;
  };
  source: MetadataSource<T>;
  lifecycle(entity: T): Lifecycle;
}
