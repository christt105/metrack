/** Makes a title usable as a folder name. */
export function sanitizeSlug(text: string): string {
  return text
    .replace(/[\\/:*?"<>|#%[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
