import type { ImageStore } from '../images/ImageStore.js';

/** Resolves an image hash to its file in the store, failing when the hash is unknown. */
export function storeImagePath(store: ImageStore): (hash: string) => string {
  return (hash) => {
    const image = store.get(hash);
    if (!image) throw new Error(`Image ${hash} is referenced but not in the store`);
    return store.pathOf(image);
  };
}
