function textCost(codePoint: string): number {
  if (codePoint === "'") return 2;
  if (codePoint === '\n' || codePoint === '\r') return 12;
  return Buffer.byteLength(codePoint);
}

/**
 * Splits a text or blob value into pieces whose SQL literals stay under `budget` bytes. Text is cut between code
 * points, blobs between bytes, so every piece can be written and encoded on its own.
 */
export function chunkValue(value: string | Uint8Array, budget: number): (string | Uint8Array)[] {
  if (typeof value !== 'string') {
    const size = Math.max(1, Math.floor(budget / 2));
    const pieces: Uint8Array[] = [];
    for (let at = 0; at < value.length; at += size) pieces.push(value.subarray(at, at + size));
    return pieces.length > 0 ? pieces : [value];
  }
  const pieces: string[] = [];
  let current = '';
  let cost = 0;
  for (const codePoint of value) {
    const next = textCost(codePoint);
    if (cost + next > budget && current !== '') {
      pieces.push(current);
      current = '';
      cost = 0;
    }
    current += codePoint;
    cost += next;
  }
  pieces.push(current);
  return pieces;
}
