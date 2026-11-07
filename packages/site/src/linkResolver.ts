import type { Library } from './Library.js';
import { allEntries } from './allEntries.js';
import { entryPath } from './sitePaths.js';

/** Maps a vault file name to the page of the item that had it, for wikilinks in reviews. */
export function linkResolver(library: Library): (name: string) => string | null {
  const byName = new Map<string, string>();
  for (const entry of allEntries(library)) {
    if (entry.slug !== null && !byName.has(entry.slug)) {
      byName.set(entry.slug, entryPath(library.handle, entry.kind, entry.id));
    }
  }
  return (name) => byName.get(name) ?? null;
}
