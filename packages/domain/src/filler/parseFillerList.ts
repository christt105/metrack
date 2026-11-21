import { decodeHtmlEntities } from './decodeHtmlEntities.js';
import type { FillerCategory } from './FillerCategory.js';
import type { FillerEntry } from './FillerEntry.js';

const CATEGORY_OF_CLASS: Record<string, FillerCategory> = {
  filler: 'filler',
  'mixed_canon/filler': 'mixed',
  manga_canon: 'mangaCanon',
  anime_canon: 'animeCanon',
};

const ROW = /<tr\s+class="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi;
const NUMBER_CELL = /<td\s+class="Number"[^>]*>\s*(\d+)\s*<\/td>/i;
const TITLE_CELL = /<td\s+class="Title"[^>]*>([\s\S]*?)<\/td>/i;

/**
 * Reads the episode rows of an AnimeFillerList show page, in document order. Rows whose class is not one of the
 * four known categories, or that have no episode number, are ignored, so a page without a list (an unknown show)
 * gives an empty list.
 */
export function parseFillerList(html: string): FillerEntry[] {
  const entries: FillerEntry[] = [];
  for (const row of html.matchAll(ROW)) {
    const category = CATEGORY_OF_CLASS[(row[1] ?? '').trim().split(/\s+/)[0] ?? ''];
    const number = NUMBER_CELL.exec(row[2] ?? '')?.[1];
    if (category === undefined || number === undefined) continue;
    const title = decodeHtmlEntities(
      (TITLE_CELL.exec(row[2] ?? '')?.[1] ?? '').replace(/<[^>]*>/g, ''),
    )
      .replace(/\s+/g, ' ')
      .trim();
    entries.push({ number: Number(number), category, title });
  }
  return entries;
}
