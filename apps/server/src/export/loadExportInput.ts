import type { ExportInput } from '@metrack/export';
import { imageRef } from '../images/imageRef.js';
import type { ImageStore } from '../images/ImageStore.js';
import type {
  BookRepository,
  MovieRepository,
  SeasonRepository,
  SeriesRepository,
  VideogameRepository,
} from '../storage/repositories/index.js';

export interface ExportSources {
  movies: MovieRepository;
  series: SeriesRepository;
  seasons: SeasonRepository;
  videogames: VideogameRepository;
  books: BookRepository;
  images: ImageStore;
}

/** Reads everything the exporter needs from the repositories and the image store. */
export function loadExportInput(sources: ExportSources): ExportInput {
  return {
    movies: sources.movies.list(),
    series: sources.series.list(),
    seasons: sources.seasons.list(),
    videogames: sources.videogames.list(),
    books: sources.books.list(),
    images: sources.images.list().map((image) => ({
      ref: imageRef(image.hash),
      hash: image.hash,
      extension: image.extension,
      sourceUrl: image.sourceUrl,
    })),
  };
}
