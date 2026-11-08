import type { Library } from './Library.js';

/** What the pages call their owner: the intro they wrote, or else their handle. */
export function ownerName(library: Library): string {
  return library.profile.intro ?? `@${library.handle}`;
}
