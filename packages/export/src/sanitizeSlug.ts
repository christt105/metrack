import { isSafeSlug } from '@metrack/domain';

/** Makes a title usable as a folder name, or returns an empty string when nothing usable is left. */
export function sanitizeSlug(text: string): string {
  const name = text
    .replace(/[\\/:*?"<>|#%[\]\p{Cc}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return isSafeSlug(name) ? name : '';
}
