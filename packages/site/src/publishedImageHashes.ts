import type { Library } from './Library.js';
import { allEntries } from './allEntries.js';
import { ownImageHash } from './imageSrc.js';
import { imageHashesIn } from './markdown/imageHashesIn.js';

/** Hashes of the stored images the user's public pages show: covers, banners and images embedded in shown reviews. */
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
  return hashes;
}
