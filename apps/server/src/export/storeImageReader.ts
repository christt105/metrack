import type { ImageStore } from '../images/ImageStore.js';

/** Reads the bytes of an image hash from the store, failing when the hash is unknown. */
export function storeImageReader(store: ImageStore): (hash: string) => Promise<Uint8Array> {
  return async (hash) => {
    const image = await store.get(hash);
    if (!image) throw new Error(`Image ${hash} is referenced but not in the store`);
    return store.read(image);
  };
}
