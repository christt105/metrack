import type { Book, Movie, Season, Series, Videogame } from '@metrack/domain';
import type { ExportImage } from './ExportImage.js';

/** Everything the exporter reads. It never touches the database or the disk. */
export interface ExportInput {
  movies: Movie[];
  series: Series[];
  seasons: Season[];
  videogames: Videogame[];
  books: Book[];
  images: ExportImage[];
}
