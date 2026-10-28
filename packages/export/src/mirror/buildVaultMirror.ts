import { assignSlugs } from '../assignSlugs.js';
import type { ExportInput } from '../ExportInput.js';
import { buildDrafts } from './buildDrafts.js';
import { mergeNote } from './mergeNote.js';
import type { MirroredNote } from './MirroredNote.js';
import type { MirrorOptions } from './MirrorOptions.js';

/**
 * Builds the read-only Obsidian copy of the library, one note per page of the site, with the same
 * names and folders the Obsidian plugin used so existing links keep working. Pure: the caller reads
 * the existing notes and writes the result.
 */
export function buildVaultMirror(input: ExportInput, options: MirrorOptions): MirroredNote[] {
  return buildDrafts(input, assignSlugs(input), options.webUrl)
    .map((draft) => mergeNote(draft, options.existing.get(draft.path), options.images))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
