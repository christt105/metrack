import type { MarkEpisodesOperation } from './MarkEpisodesOperation.js';
import type { SetEpisodeViewingsOperation } from './SetEpisodeViewingsOperation.js';
import type { SkipEpisodesOperation } from './SkipEpisodesOperation.js';
import type { UnmarkEpisodesOperation } from './UnmarkEpisodesOperation.js';
import type { UnskipEpisodesOperation } from './UnskipEpisodesOperation.js';

/** What `PATCH /api/seasons/{id}/episodes` does to the watched and skipped episodes of a season. */
export type EpisodeOperation =
  | MarkEpisodesOperation
  | UnmarkEpisodesOperation
  | SetEpisodeViewingsOperation
  | SkipEpisodesOperation
  | UnskipEpisodesOperation;
