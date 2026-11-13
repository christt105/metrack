import type { RandomBytes } from '@metrack/domain';

/** Random bytes from the Web Crypto API, available in Node and in Workers. */
export const secureRandomBytes: RandomBytes = (length) =>
  crypto.getRandomValues(new Uint8Array(length));
