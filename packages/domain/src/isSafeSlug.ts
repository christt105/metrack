import { SLUG_PATTERN } from './SLUG_PATTERN.js';

const slugPattern = new RegExp(SLUG_PATTERN, 'u');

/** Whether a name can be used verbatim as the folder of an exported page. */
export function isSafeSlug(name: string): boolean {
  return slugPattern.test(name);
}
