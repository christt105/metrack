import { crc32 } from './crc32';
import { deflateRaw } from './deflateRaw';

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const UTF8_NAMES = 0x0800;
const STORED = 0;
const DEFLATED = 8;
const MAX_CLASSIC = 0xffffffff;
const MAX_ENTRIES = 0xffff;

interface Member {
  name: Uint8Array;
  method: number;
  crc: number;
  size: number;
  compressedSize: number;
  offset: number;
}

/**
 * Builds a ZIP file in the browser. A member is stored as given, or deflated when asked to and the browser
 * can (it is stored otherwise). The classic format is used, so an archive of 4 GB or 65535 members is refused.
 */
export class ZipWriter {
  private readonly parts: Uint8Array[] = [];
  private readonly members: Member[] = [];
  private offset = 0;
  private readonly dosTime: number;
  private readonly dosDate: number;

  constructor(modified: Date) {
    const year = Math.max(modified.getUTCFullYear(), 1980);
    this.dosTime =
      (modified.getUTCHours() << 11) |
      (modified.getUTCMinutes() << 5) |
      Math.floor(modified.getUTCSeconds() / 2);
    this.dosDate =
      ((year - 1980) << 9) | ((modified.getUTCMonth() + 1) << 5) | modified.getUTCDate();
  }

  async add(name: string, bytes: Uint8Array, compress = false): Promise<void> {
    const deflated = compress ? await deflateRaw(bytes) : null;
    const data = deflated ?? bytes;
    const member: Member = {
      name: new TextEncoder().encode(name),
      method: deflated ? DEFLATED : STORED,
      crc: crc32(bytes),
      size: bytes.length,
      compressedSize: data.length,
      offset: this.offset,
    };
    const header = this.localHeader(member);
    this.offset += header.length + member.name.length + data.length;
    if (this.members.length >= MAX_ENTRIES || this.offset > MAX_CLASSIC) {
      throw new Error('The archive is too large for the ZIP format used');
    }
    this.members.push(member);
    this.parts.push(header, member.name, data);
  }

  toBlob(): Blob {
    const directory: Uint8Array[] = [];
    let directorySize = 0;
    for (const member of this.members) {
      const header = this.centralHeader(member);
      directory.push(header, member.name);
      directorySize += header.length + member.name.length;
    }
    const end = this.endRecord(this.offset, directorySize);
    return new Blob([...this.parts, ...directory, end] as BlobPart[], { type: 'application/zip' });
  }

  private localHeader(member: Member): Uint8Array {
    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    view.setUint32(0, LOCAL_HEADER, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, UTF8_NAMES, true);
    view.setUint16(8, member.method, true);
    view.setUint16(10, this.dosTime, true);
    view.setUint16(12, this.dosDate, true);
    view.setUint32(14, member.crc, true);
    view.setUint32(18, member.compressedSize, true);
    view.setUint32(22, member.size, true);
    view.setUint16(26, member.name.length, true);
    return header;
  }

  private centralHeader(member: Member): Uint8Array {
    const header = new Uint8Array(46);
    const view = new DataView(header.buffer);
    view.setUint32(0, CENTRAL_HEADER, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, UTF8_NAMES, true);
    view.setUint16(10, member.method, true);
    view.setUint16(12, this.dosTime, true);
    view.setUint16(14, this.dosDate, true);
    view.setUint32(16, member.crc, true);
    view.setUint32(20, member.compressedSize, true);
    view.setUint32(24, member.size, true);
    view.setUint16(28, member.name.length, true);
    view.setUint32(42, member.offset, true);
    return header;
  }

  private endRecord(directoryStart: number, directorySize: number): Uint8Array {
    const record = new Uint8Array(22);
    const view = new DataView(record.buffer);
    view.setUint32(0, END_OF_CENTRAL_DIRECTORY, true);
    view.setUint16(8, this.members.length, true);
    view.setUint16(10, this.members.length, true);
    view.setUint32(12, directorySize, true);
    view.setUint32(16, directoryStart, true);
    return record;
  }
}
