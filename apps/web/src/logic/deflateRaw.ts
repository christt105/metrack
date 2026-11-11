/** Deflates the bytes without a header, as ZIP expects; null when the browser cannot compress. */
export async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    const written = writer.write(bytes as BufferSource).then(() => writer.close());
    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      chunks.push(chunk.value);
    }
    await written;
    const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let at = 0;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  } catch {
    return null;
  }
}
