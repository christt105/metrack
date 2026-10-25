import type {
  BookRepository,
  MovieRepository,
  SeasonOverrideRepository,
  SeasonRepository,
  SeriesRepository,
  VideogameRepository,
} from '../storage/repositories/index.js';

export interface MediaKindSources {
  movies: MovieRepository;
  series: SeriesRepository;
  seasons: SeasonRepository;
  videogames: VideogameRepository;
  books: BookRepository;
  overrides: SeasonOverrideRepository;
}
