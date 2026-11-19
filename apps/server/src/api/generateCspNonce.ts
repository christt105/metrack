const NONCE_BYTES = 16;

/** A fresh, random, base64 value for one response's `script-src` nonce. */
export function generateCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  return btoa(String.fromCharCode(...bytes));
}
