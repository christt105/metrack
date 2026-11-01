import type { OpenLibraryEdition } from './OpenLibraryEdition.js';

/** A work as returned by the search endpoint, with the edition that best matches the language. */
export interface OpenLibraryWork {
  /** Work key, such as `/works/OL8479867W`. */
  key: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  number_of_pages_median?: number;
  subject?: string[];
  editions?: { docs?: OpenLibraryEdition[] };
}
