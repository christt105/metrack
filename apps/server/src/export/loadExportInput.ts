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
export async function loadExportInput(sources: ExportSources): Promise<ExportInput> {
  return {
    movies: await sources.movies.list(),
    series: await sources.series.list(),
    seasons: await sources.seasons.list(),
    videogames: await sources.videogames.list(),
    books: await sources.books.list(),
    images: (await sources.images.list()).map((image) => ({
      ref: imageRef(image.hash),
      hash: image.hash,
      extension: image.extension,
      sourceUrl: image.sourceUrl,
    })),
  };
}
