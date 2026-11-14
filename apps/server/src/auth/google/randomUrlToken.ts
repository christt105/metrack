/** `bytes` random bytes from the Web Crypto generator, as base64url. */
export function randomUrlToken(bytes = 32): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
}
