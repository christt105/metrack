import type { Library } from './Library.js';

/** Where the movies and the series structure come from. */
export interface LibrarySource {
  load(): Promise<Library>;
}
