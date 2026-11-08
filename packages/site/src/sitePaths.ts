import type { PublicKind } from './PublicKind.js';

export const ASSET_ROOT = '/u/assets';

export function assetPath(name: string): string {
  return `${ASSET_ROOT}/${name}`;
}

export function homePath(handle: string): string {
  return `/u/${handle}/`;
}

export function feedPath(handle: string): string {
  return `/u/${handle}/feed.xml`;
}

export function indexPath(handle: string): string {
  return `/u/${handle}/index.json`;
}

export function statsPath(handle: string): string {
  return `/u/${handle}/stats/`;
}

export function collagePath(handle: string): string {
  return `/u/${handle}/collage/`;
}

export function aboutPath(handle: string): string {
  return `/u/${handle}/about/`;
}

export function entryPath(handle: string, kind: PublicKind, id: number): string {
  return `/u/${handle}/${kind}/${id}`;
}

export function imagePath(handle: string, hash: string): string {
  return `/u/${handle}/images/${hash}`;
}
