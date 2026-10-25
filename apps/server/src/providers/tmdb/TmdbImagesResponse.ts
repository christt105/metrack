import type { TmdbImage } from './TmdbImage.js';

export interface TmdbImagesResponse {
  posters?: TmdbImage[];
  backdrops?: TmdbImage[];
}
