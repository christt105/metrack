import type { ExistingNote } from './ExistingNote.js';
import type { Field } from './Field.js';
import { linkTargets } from './linkTargets.js';
import type { MirrorImages } from './MirrorImages.js';
import type { MirroredNote } from './MirroredNote.js';
import type { NoteDraft } from './NoteDraft.js';
import { renderVaultFrontmatter } from './renderVaultFrontmatter.js';
import { sameReview } from './sameReview.js';

const STORED_IMAGE = /!\[([^\]]*)\]\((\/api\/images\/[0-9a-f]{64})\)/g;

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (Array.isArray(value) && value.length === 0);
}

function sameTargets(a: unknown, b: unknown): boolean {
  const left = linkTargets(a);
  const right = linkTargets(b);
  return left !== null && right !== null && left.join('\n') === right.join('\n');
}

function resolveField(field: Field, current: unknown, images: MirrorImages): unknown {
  if (field.kind === 'image') {
    return typeof field.value === 'string' ? images.propertyValue(field.value, current) : null;
  }
  if (field.kind === 'links' && current !== undefined && sameTargets(current, field.value)) {
    return current;
  }
  return field.value;
}

function renderReview(review: string, images: MirrorImages): string {
  return review.replace(STORED_IMAGE, (whole, _alt: string, ref: string) => {
    const path = images.embedPath(ref);
    return path === null ? whole : `![[${path}]]`;
  });
}

/**
 * Combines a draft with the note already on disk. The note keeps its key order and every property
 * the mirror does not own (related notes, aliases, CSS classes...). Values that already mean the
 * same thing (the same image, links to the same notes, the same review) are kept as written.
 */
export function mergeNote(
  draft: NoteDraft,
  existing: ExistingNote | undefined,
  images: MirrorImages,
): MirroredNote {
  const current = existing?.frontmatter ?? {};
  const owned = new Map<string, unknown>();
  for (const field of draft.fields) {
    const value = resolveField(field, current[field.key], images);
    if (field.always || !isEmpty(value) || field.key in current) owned.set(field.key, value);
  }

  const entries: [string, unknown][] = [];
  const owns = new Set(draft.fields.map((field) => field.key));
  for (const key of Object.keys(current)) {
    if (owned.has(key)) entries.push([key, owned.get(key)]);
    else if (!owns.has(key)) entries.push([key, current[key]]);
  }
  const placed = new Set(entries.map(([key]) => key));
  for (const [key, value] of owned) if (!placed.has(key)) entries.push([key, value]);
  if (existing === undefined) {
    for (const [key, value] of Object.entries(draft.defaults)) entries.push([key, value]);
  }

  const body =
    existing !== undefined && sameReview(existing.body, draft.review)
      ? existing.body
      : draft.review === null || draft.review.trim() === ''
        ? ''
        : `${renderReview(draft.review.trim(), images)}\n`;
  return { path: draft.path, content: renderVaultFrontmatter(entries) + body };
}
