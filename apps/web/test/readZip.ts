import { crc32, inflateRawSync } from 'node:zlib';

/** Reads a ZIP through its central directory and checks every CRC; returns the members by name. */
export async function readZip(blob: Blob): Promise<Map<string, Buffer>> {
  const bytes = Buffer.from(await blob.arrayBuffer());
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('No end of central directory');
  const count = bytes.readUInt16LE(end + 10);
  let at = bytes.readUInt32LE(end + 16);
  const members = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(at) !== 0x02014b50) throw new Error('Bad central header');
    const method = bytes.readUInt16LE(at + 10);
    const crc = bytes.readUInt32LE(at + 16);
    const compressed = bytes.readUInt32LE(at + 20);
    const size = bytes.readUInt32LE(at + 24);
    const nameLength = bytes.readUInt16LE(at + 28);
    const offset = bytes.readUInt32LE(at + 42);
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    if (bytes.readUInt32LE(offset) !== 0x04034b50) throw new Error('Bad local header');
    const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
    const raw = bytes.subarray(start, start + compressed);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    if (data.length !== size || crc32(data) !== crc) throw new Error(`Corrupt member ${name}`);
    members.set(name, Buffer.from(data));
    at += 46 + nameLength;
  }
  return members;
}
