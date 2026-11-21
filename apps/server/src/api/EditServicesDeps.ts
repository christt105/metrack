import type { ImageProvider } from '../artwork/ImageProvider.js';
import type { FetchFn } from '../http/FetchFn.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { MediaKindSources } from '../media/MediaKindSources.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import type { EpisodeWatchRepository } from '../storage/repositories/EpisodeWatchRepository.js';
import type { SeasonEpisodesRepository } from '../storage/repositories/SeasonEpisodesRepository.js';
import type { SeasonFillerRepository } from '../storage/repositories/SeasonFillerRepository.js';
import type { MetadataStateRepository } from '../storage/repositories/MetadataStateRepository.js';
import type { UnlinkedTitleRepository } from '../storage/repositories/UnlinkedTitleRepository.js';
import type { TitleProviders } from '../titles/TitleProviders.js';

export interface EditServicesDeps {
  sources: MediaKindSources;
  unlinked: UnlinkedTitleRepository;
  states: MetadataStateRepository;
  images: ImageStore;
  cache: MetadataCache;
  tmdb?: TmdbClient;
  seasonEpisodes: SeasonEpisodesRepository;
  seasonFiller: SeasonFillerRepository;
  episodeWatches: EpisodeWatchRepository;
  titleProviders: TitleProviders;
  imageProviders: readonly ImageProvider[];
  /** Used to read AnimeFillerList for the filler preview. */
  fetchFn: FetchFn;
  now?: () => Date;
}
