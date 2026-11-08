import type { Library } from './Library.js';
import { allEntries } from './allEntries.js';
import { ownImageHash } from './imageSrc.js';
import { imageHashesIn } from './markdown/imageHashesIn.js';

/** Hashes of the stored images the user's public pages show: covers, banners, the avatar and images embedded in shown reviews and the about text. */
export function publishedImageHashes(library: Library): Set<string> {
  const hashes = new Set<string>();
  for (const entry of allEntries(library)) {
    for (const ref of [entry.cover, entry.banner]) {
      const hash = ref === null ? null : ownImageHash(ref);
      if (hash !== null) hashes.add(hash);
    }
    if (entry.review !== null) {
      for (const hash of imageHashesIn(entry.review)) hashes.add(hash);
    }
  }
  const { avatar, about } = library.profile;
  const avatarHash = avatar === null ? null : ownImageHash(avatar);
  if (avatarHash !== null) hashes.add(avatarHash);
  if (about !== null) {
    for (const hash of imageHashesIn(about)) hashes.add(hash);
  }
  return hashes;
}
