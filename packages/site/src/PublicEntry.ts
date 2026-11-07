import type { MediaStatus } from '@metrack/domain';
import type { PublicKind } from './PublicKind.js';

/** One item that may be shown on a public page: a piece of the library that is not pending review. */
export interface PublicEntry {
  kind: PublicKind;
  id: number;
  title: string;
  /** File name the item had in the vault, used to resolve wikilinks in reviews. */
  slug: string | null;
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
  rating: number | null;
  review: string | null;
  rewatches: string[];
  cover: string | null;
  banner: string | null;
  releaseDate: string | null;
  overview: string | null;
  genres: string[];
  tags: string[];
  platforms: string[];
  developer: string | null;
  authors: string[];
  /** Address of the item at its provider, when it has an id there. */
  externalUrl: string | null;
  externalLabel: string | null;
  /** The series a season belongs to. */
  seriesId: number | null;
}
