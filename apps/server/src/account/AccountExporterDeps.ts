import type { ImageStore } from '../images/ImageStore.js';
import type { ApiTokenRepository } from '../storage/repositories/ApiTokenRepository.js';
import type { BookRepository } from '../storage/repositories/BookRepository.js';
import type { EpisodeWatchRepository } from '../storage/repositories/EpisodeWatchRepository.js';
import type { InviteRepository } from '../storage/repositories/InviteRepository.js';
import type { MovieRepository } from '../storage/repositories/MovieRepository.js';
import type { PublicProfileRepository } from '../storage/repositories/PublicProfileRepository.js';
import type { ReleaseAlertRepository } from '../storage/repositories/ReleaseAlertRepository.js';
import type { SeasonOverrideRepository } from '../storage/repositories/SeasonOverrideRepository.js';
import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';
import type { SeriesRepository } from '../storage/repositories/SeriesRepository.js';
import type { UnlinkedTitleRepository } from '../storage/repositories/UnlinkedTitleRepository.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import type { VideogameRepository } from '../storage/repositories/VideogameRepository.js';

/** What the exporter reads. The personal repositories answer for the user in scope. */
export interface AccountExporterDeps {
  users: UserRepository;
  settings: UserSettingsRepository;
  profiles: PublicProfileRepository;
  apiTokens: ApiTokenRepository;
  invites: InviteRepository;
  movies: MovieRepository;
  series: SeriesRepository;
  seasons: SeasonRepository;
  videogames: VideogameRepository;
  books: BookRepository;
  overrides: SeasonOverrideRepository;
  episodeWatches: EpisodeWatchRepository;
  unlinked: UnlinkedTitleRepository;
  releaseAlerts: ReleaseAlertRepository;
  images: ImageStore;
}
