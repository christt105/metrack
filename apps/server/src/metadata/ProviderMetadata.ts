/**
 * What a provider returned for one entity. `fields` are entity properties; the image URLs
 * are downloaded into the image store and replace `cover` and `banner` with local references.
 */
export interface ProviderMetadata<T> {
  fields: Partial<Omit<T, 'id'>>;
  coverUrl?: string | null;
  bannerUrl?: string | null;
}
