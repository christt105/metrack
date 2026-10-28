const openableSchemes = ['obsidian:', 'http:', 'https:'];

/** The value as a URL safe to open from a link, or null when it is not one. */
export function openableLink(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!URL.canParse(text)) return null;
  return openableSchemes.includes(new URL(text).protocol) ? text : null;
}
