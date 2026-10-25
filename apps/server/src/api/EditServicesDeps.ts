import type { ImageProvider } from '../artwork/ImageProvider.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { MediaKindSources } from '../media/MediaKindSources.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import type { MetadataStateRepository } from '../metadata/MetadataStateRepository.js';
import type { UnlinkedTitleRepository } from '../storage/repositories/UnlinkedTitleRepository.js';
import type { TitleProviders } from '../titles/TitleProviders.js';

export interface EditServicesDeps {
  sources: MediaKindSources;
  unlinked: UnlinkedTitleRepository;
  states: MetadataStateRepository;
  images: ImageStore;
  cache: MetadataCache;
  titleProviders: TitleProviders;
  imageProviders: readonly ImageProvider[];
  now?: () => Date;
}
