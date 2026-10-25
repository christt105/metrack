import type { ProviderMetadata } from './ProviderMetadata.js';

export interface MetadataSource<T> {
  fetch(entity: T): Promise<ProviderMetadata<T>>;
}
