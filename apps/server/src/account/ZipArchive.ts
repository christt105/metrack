import { crc32, deflateRawSync } from 'node:zlib';

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const UTF8_NAMES = 0x0800;
const STORED = 0;
const DEFLATED = 8;
const MAX_CLASSIC = 0xffffffff;
const MAX_ENTRIES = 0xffff;

interface Member {
  name: Buffer;
  method: number;
  crc: number;
  size: number;
  data: Buffer;
  offset: number;
}

/**
 * Builds a ZIP file in memory. Every member is written whole, stored as given or deflated when asked to;
 * the classic format is used, so an archive of 4 GB or 65535 members is refused.
 */
export class ZipArchive {
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

  add(name: string, bytes: Uint8Array, compress = false): void {
    const raw = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const data = compress ? deflateRawSync(raw) : raw;
    const member: Member = {
      name: Buffer.from(name, 'utf8'),
      method: compress ? DEFLATED : STORED,
      crc: crc32(raw),
      size: raw.byteLength,
      data,
      offset: this.offset,
    };
    this.offset += 30 + member.name.byteLength + data.byteLength;
    this.members.push(member);
    if (this.members.length > MAX_ENTRIES || this.offset > MAX_CLASSIC) {
      throw new Error('The archive is too large for the ZIP format used');
    }
  }

  toBuffer(): Buffer {
    const parts: Buffer[] = [];
    for (const member of this.members) {
      parts.push(this.localHeader(member), member.name, member.data);
    }
    const directoryStart = this.offset;
    let directorySize = 0;
    for (const member of this.members) {
      const header = this.centralHeader(member);
      parts.push(header, member.name);
      directorySize += header.byteLength + member.name.byteLength;
    }
    parts.push(this.endRecord(directoryStart, directorySize));
    return Buffer.concat(parts);
  }

  private localHeader(member: Member): Buffer {
    const header = Buffer.alloc(30);
    header.writeUInt32LE(LOCAL_HEADER, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(UTF8_NAMES, 6);
    header.writeUInt16LE(member.method, 8);
    header.writeUInt16LE(this.dosTime, 10);
    header.writeUInt16LE(this.dosDate, 12);
    header.writeUInt32LE(member.crc, 14);
    header.writeUInt32LE(member.data.byteLength, 18);
    header.writeUInt32LE(member.size, 22);
    header.writeUInt16LE(member.name.byteLength, 26);
    return header;
  }

  private centralHeader(member: Member): Buffer {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(CENTRAL_HEADER, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(UTF8_NAMES, 8);
    header.writeUInt16LE(member.method, 10);
    header.writeUInt16LE(this.dosTime, 12);
    header.writeUInt16LE(this.dosDate, 14);
    header.writeUInt32LE(member.crc, 16);
    header.writeUInt32LE(member.data.byteLength, 20);
    header.writeUInt32LE(member.size, 24);
    header.writeUInt16LE(member.name.byteLength, 28);
    header.writeUInt32LE(member.offset, 42);
    return header;
  }

  private endRecord(directoryStart: number, directorySize: number): Buffer {
    const record = Buffer.alloc(22);
    record.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
    record.writeUInt16LE(this.members.length, 8);
    record.writeUInt16LE(this.members.length, 10);
    record.writeUInt32LE(directorySize, 12);
    record.writeUInt32LE(directoryStart, 16);
    return record;
  }
}
