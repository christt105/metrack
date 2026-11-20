import { slugifyName } from './slugifyName.js';

/** The slugs to try for a series, in order: its title, then its original title, without empty or repeated ones. */
export function fillerSlugCandidates(title: string, originalTitle: string | null): string[] {
  const slugs = [title, originalTitle ?? ''].map(slugifyName).filter((slug) => slug !== '');
  return [...new Set(slugs)];
}
