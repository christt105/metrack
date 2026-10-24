const PREFIX = '/api/images/';
const HASH_PATTERN = /^[0-9a-f]{64}$/;

/** The reference stored in `cover` and `banner` columns for a stored image. */
export function imageRef(hash: string): string {
  return `${PREFIX}${hash}`;
}

export function isImageHash(value: string): boolean {
  return HASH_PATTERN.test(value);
}
