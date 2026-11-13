import type { MetadataSource } from '../../src/metadata/MetadataSource.js';
import type { ProviderMetadata } from '../../src/metadata/ProviderMetadata.js';

/** A provider that answers `fields` for every title, except the titles listed in `failing`, whose fetch throws. */
export class ScriptedMetadataSource<T extends { title: string }> implements MetadataSource<T> {
  readonly failing = new Set<string>();
  readonly fetched: string[] = [];

  constructor(private readonly fields: Partial<Omit<T, 'id'>>) {}

  fetch(entity: T): Promise<ProviderMetadata<T>> {
    this.fetched.push(entity.title);
    if (this.failing.has(entity.title)) return Promise.reject(new Error('provider down'));
    return Promise.resolve({ fields: this.fields });
  }
}
