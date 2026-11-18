import type { MarkEpisodesOperation } from './MarkEpisodesOperation.js';
import type { SetEpisodeViewingsOperation } from './SetEpisodeViewingsOperation.js';
import type { UnmarkEpisodesOperation } from './UnmarkEpisodesOperation.js';

/** What `PATCH /api/seasons/{id}/episodes` does to the watched episodes of a season. */
export type EpisodeOperation =
  MarkEpisodesOperation | UnmarkEpisodesOperation | SetEpisodeViewingsOperation;
