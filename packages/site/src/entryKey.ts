import type { PublicKind } from './PublicKind.js';

export function entryKey(kind: PublicKind, id: number): string {
  return `${kind}/${id}`;
}
