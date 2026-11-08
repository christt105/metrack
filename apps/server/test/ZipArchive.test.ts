import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ZipArchive } from '../src/account/ZipArchive.js';
import { readZip } from './support/readZip.js';

describe('ZipArchive', () => {
  it('round-trips stored and deflated members, including non-ASCII names', () => {
    const zip = new ZipArchive(new Date('2026-11-08T10:30:00Z'));
    const text = Buffer.from('hello '.repeat(100));
    const binary = Buffer.from([0, 1, 2, 3, 255]);
    zip.add('a/ñ.txt', text, true);
    zip.add('b.bin', binary);
    zip.add('empty', new Uint8Array());
    const members = readZip(zip.toBuffer());
    expect([...members.keys()]).toEqual(['a/ñ.txt', 'b.bin', 'empty']);
    expect(members.get('a/ñ.txt')).toEqual(text);
    expect(members.get('b.bin')).toEqual(binary);
    expect(members.get('empty')).toHaveLength(0);
  });

  it('is accepted by the unzip tool', () => {
    const zip = new ZipArchive(new Date('2026-11-08T10:30:00Z'));
    zip.add('data.json', Buffer.from('{"a":1}'), true);
    zip.add('images/x.webp', Buffer.from('xyz'));
    const file = join(mkdtempSync(join(tmpdir(), 'metrack-zip-')), 'out.zip');
    writeFileSync(file, zip.toBuffer());
    let output: string;
    try {
      output = execFileSync('unzip', ['-t', file], { encoding: 'utf8' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    expect(output).toContain('No errors detected');
  });
});
