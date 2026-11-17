import type { InjectionKey } from 'vue';
import type { LibraryCache } from './LibraryCache';

export const libraryCacheKey: InjectionKey<LibraryCache> = Symbol('libraryCache');
