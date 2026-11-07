import type { PublicKind } from './PublicKind.js';

export const STYLESHEET_PATH = '/u/assets/site.css';

export function homePath(handle: string): string {
  return `/u/${handle}/`;
}

export function feedPath(handle: string): string {
  return `/u/${handle}/feed.xml`;
}

export function entryPath(handle: string, kind: PublicKind, id: number): string {
  return `/u/${handle}/${kind}/${id}`;
}

export function imagePath(handle: string, hash: string): string {
  return `/u/${handle}/images/${hash}`;
}
