import { inflateRawSync } from 'node:zlib';

/** Reads every member of a ZIP built by `ZipArchive`: name to content. */
export function readZip(zip: Buffer): Map<string, Buffer> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let cursor = zip.readUInt32LE(end + 16);
  const members = new Map<string, Buffer>();
  for (let index = 0; index < count; index += 1) {
    const method = zip.readUInt16LE(cursor + 10);
    const compressed = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const offset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const dataStart = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
    const data = zip.subarray(dataStart, dataStart + compressed);
    members.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    cursor += 46 + nameLength;
  }
  return members;
}
