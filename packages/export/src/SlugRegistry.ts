import { sanitizeSlug } from './sanitizeSlug.js';

/** Hands out folder names that are unique across the whole site, since Hugo resolves links by name. */
export class SlugRegistry {
  private readonly taken = new Set<string>();

  /** Claims a name exactly as given, or the first free `name (n)` when it is taken. */
  claimVerbatim(name: string): string {
    let candidate = name;
    for (let n = 2; this.taken.has(candidate); n += 1) candidate = `${name} (${n})`;
    this.taken.add(candidate);
    return candidate;
  }

  /** Claims a folder name made from a title. */
  claimFromTitle(title: string): string {
    return this.claimVerbatim(sanitizeSlug(title) || 'untitled');
  }

  names(): ReadonlySet<string> {
    return this.taken;
  }
}
