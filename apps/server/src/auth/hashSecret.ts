import { createHash } from 'node:crypto';

/** SHA-256 of a session or API token secret, which is all that is stored of it. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}
