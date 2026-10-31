const LINK = /\[\[([^\]|#]+)/;

/** The note names a wikilink value points at, ignoring folders and display text. */
export function linkTargets(value: unknown): string[] | null {
  const items = Array.isArray(value) ? value : [value];
  const targets: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string') return null;
    const match = LINK.exec(item);
    if (!match?.[1]) return null;
    targets.push(match[1].trim().split('/').at(-1) ?? '');
  }
  return targets;
}
