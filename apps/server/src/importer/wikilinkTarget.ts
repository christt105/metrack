import { readText } from './fieldReaders.js';

/** The note name a wikilink points to, without folders, alias or extension. */
export function wikilinkTarget(value: unknown): string | null {
  const raw = readText(value);
  if (raw === null) return null;
  const inner = /^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/.exec(raw)?.[1] ?? raw;
  const name = inner.split('/').pop()?.trim().replace(/\.md$/i, '');
  return name ? name : null;
}
