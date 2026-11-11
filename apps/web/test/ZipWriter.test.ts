import { crc32 as nodeCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ZipWriter } from '../src/logic/ZipWriter';
import { crc32 } from '../src/logic/crc32';
import { readZip } from './readZip';

const text = (value: string) => new TextEncoder().encode(value);

describe('crc32', () => {
  it('matches the reference implementation', () => {
    for (const value of ['', 'a', '123456789', 'metrack'.repeat(500)]) {
      expect(crc32(text(value))).toBe(nodeCrc32(Buffer.from(value)));
    }
    expect(crc32(text('123456789'))).toBe(0xcbf43926);
  });
});

describe('ZipWriter', () => {
  it('writes stored and deflated members that read back intact', async () => {
    const zip = new ZipWriter(new Date('2026-03-05T12:00:00Z'));
    const image = Uint8Array.from({ length: 1000 }, (_, i) => (i * 7) % 256);
    const json = text(JSON.stringify({ a: 'ñandú', rows: Array(200).fill('x') }));
    await zip.add('images/abc.webp', image);
    await zip.add('data.json', json, true);

    const members = await readZip(zip.toBlob());
    expect([...members.keys()]).toEqual(['images/abc.webp', 'data.json']);
    expect(members.get('images/abc.webp')).toEqual(Buffer.from(image));
    expect(members.get('data.json')).toEqual(Buffer.from(json));
  });

  it('deflates when asked to and the browser can', async () => {
    const zip = new ZipWriter(new Date('2026-03-05T12:00:00Z'));
    const json = text('abc'.repeat(5000));
    await zip.add('data.json', json, true);
    const blob = zip.toBlob();
    expect(blob.size).toBeLessThan(json.length / 2);
    expect(blob.type).toBe('application/zip');
  });

  it('writes an empty archive', async () => {
    const members = await readZip(new ZipWriter(new Date()).toBlob());
    expect(members.size).toBe(0);
  });
});
