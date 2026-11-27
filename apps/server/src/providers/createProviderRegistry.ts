import type { ImageProvider } from '../artwork/ImageProvider.js';
import { OpenLibraryImageProvider } from '../artwork/OpenLibraryImageProvider.js';
import { TmdbImageProvider } from '../artwork/TmdbImageProvider.js';
import type { Config } from '../config/Config.js';
import type { FetchFn } from '../http/FetchFn.js';
import type { ImageStore } from '../images/ImageStore.js';
import { MetadataCache } from '../metadata/MetadataCache.js';
import { registerTmdbMetadata } from '../metadata/registerTmdbMetadata.js';
import type { Repositories } from '../storage/repositories/index.js';
import { OpenLibraryBookProvider } from '../titles/OpenLibraryBookProvider.js';
import type { TitleProvider } from '../titles/TitleProvider.js';
import { TitleProviders } from '../titles/TitleProviders.js';
import { TmdbMovieProvider } from '../titles/TmdbMovieProvider.js';
import { TmdbSeriesProvider } from '../titles/TmdbSeriesProvider.js';
import { OpenLibraryClient } from './openlibrary/OpenLibraryClient.js';
import { TmdbClient } from './tmdb/TmdbClient.js';

export function createProviderRegistry(
  config: Pick<Config, 'tmdbApiKey' | 'tmdbLanguage' | 'openLibraryLanguage'>,
  fetchFn: FetchFn,
  repositories: Pick<
    Repositories,
    'movies' | 'series' | 'seasons' | 'seasonEpisodes' | 'books' | 'metadataStates'
  >,
  imageStore: ImageStore,
  gameProviders: { title?: TitleProvider; image?: ImageProvider },
) {
  const { movies, series, seasons, books, metadataStates } = repositories;
  const metadataCache = new MetadataCache(metadataStates, imageStore);
  const titleProviders = new TitleProviders();
  const imageProviders: ImageProvider[] = [];

  const tmdb = config.tmdbApiKey
    ? new TmdbClient(fetchFn, { apiKey: config.tmdbApiKey, language: config.tmdbLanguage })
    : undefined;
  if (tmdb) {
    registerTmdbMetadata(metadataCache, tmdb, repositories, imageStore);
    titleProviders.register(new TmdbMovieProvider(tmdb, movies, metadataCache));
    titleProviders.register(
      new TmdbSeriesProvider(tmdb, series, seasons, metadataCache, imageStore),
    );
    imageProviders.push(new TmdbImageProvider(tmdb));
  }

  if (gameProviders.image) imageProviders.push(gameProviders.image);
  if (gameProviders.title) titleProviders.register(gameProviders.title);

  const openLibrary = new OpenLibraryClient(fetchFn, config.openLibraryLanguage);
  titleProviders.register(new OpenLibraryBookProvider(openLibrary, books, imageStore));
  imageProviders.push(new OpenLibraryImageProvider(openLibrary));

  return { metadataCache, titleProviders, imageProviders, tmdb };
}
