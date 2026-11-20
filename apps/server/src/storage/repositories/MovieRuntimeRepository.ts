import type { MissingRuntime } from './MissingRuntime.js';

/** The running time of the shared movie catalog; not scoped to a user. */
export interface MovieRuntimeRepository {
  /** The catalog movies with a TMDB id and no stored running time, lowest id first. */
  listMissing(limit: number): Promise<MissingRuntime[]>;
  /** Stores the running time of a catalog movie; 0 records that TMDB has none. */
  set(id: number, minutes: number): Promise<void>;
}
