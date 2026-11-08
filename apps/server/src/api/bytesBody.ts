/** Bytes as a response body. */
export function bytesBody(bytes: Uint8Array): BodyInit {
  return bytes as Uint8Array<ArrayBuffer>;
}
