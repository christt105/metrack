import type { ArtworkService } from '../artwork/ArtworkService.js';
import type { MediaCatalog } from '../media/MediaCatalog.js';
import type { MediaEditor } from '../media/MediaEditor.js';
import type { SeasonOverrideRepository } from '../storage/repositories/SeasonOverrideRepository.js';
import type { SeriesRepository } from '../storage/repositories/SeriesRepository.js';
import type { UnlinkedTitleRepository } from '../storage/repositories/UnlinkedTitleRepository.js';
import type { TitleProviders } from '../titles/TitleProviders.js';
import type { UnlinkedResolver } from '../titles/UnlinkedResolver.js';

/** The objects the editing API routes are built on. */
export interface EditServices {
  editor: MediaEditor;
  catalog: MediaCatalog;
  artwork: ArtworkService;
  titleProviders: TitleProviders;
  resolver: UnlinkedResolver;
  series: SeriesRepository;
  overrides: SeasonOverrideRepository;
  unlinked: UnlinkedTitleRepository;
}
