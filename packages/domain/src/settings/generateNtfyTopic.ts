import { NTFY_TOPIC_PREFIX } from './NTFY_TOPIC_PREFIX.js';
import { NTFY_TOPIC_RANDOM_BYTES } from './NTFY_TOPIC_RANDOM_BYTES.js';
import type { RandomBytes } from './RandomBytes.js';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/** A new unguessable ntfy topic: `metrack-` plus 160 random bits in lowercase base32. Only `[a-z0-9-]`, 40 characters. */
export function generateNtfyTopic(randomBytes: RandomBytes): string {
  const bytes = randomBytes(NTFY_TOPIC_RANDOM_BYTES);
  let bits = 0;
  let value = 0;
  let encoded = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  return NTFY_TOPIC_PREFIX + encoded;
}
