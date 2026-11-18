import type {
  BookRepository,
  EpisodeWatchRepository,
  MovieRepository,
  SeasonRepository,
  SeriesRepository,
  VideogameRepository,
} from '../storage/repositories/index.js';

export interface MediaKindSources {
  movies: MovieRepository;
  series: SeriesRepository;
  seasons: SeasonRepository;
  episodeWatches: EpisodeWatchRepository;
  videogames: VideogameRepository;
  books: BookRepository;
}
