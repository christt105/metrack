import { imageSrc } from './imageSrc.js';
import type { Library } from './Library.js';
import { assetPath } from './sitePaths.js';

/** Where the owner's avatar loads from, or the neutral default when they have not chosen one. */
export function avatarSrc(library: Library): string {
  return (
    imageSrc(library.profile.avatar, library.handle, 'thumb') ?? assetPath('default-avatar.svg')
  );
}
