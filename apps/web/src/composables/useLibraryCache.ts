import { inject } from 'vue';
import type { LibraryCache } from '../library/LibraryCache';
import { libraryCacheKey } from '../library/libraryCacheKey';

/** The library page cache provided by the app root. */
export function useLibraryCache(): LibraryCache {
  const cache = inject(libraryCacheKey);
  if (!cache) throw new Error('LibraryCache was not provided');
  return cache;
}
