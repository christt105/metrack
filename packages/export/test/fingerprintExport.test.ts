import { describe, expect, it } from 'vitest';
import { fingerprintExport } from '../src/fingerprintExport.js';
import type { ExportedFile } from '../src/ExportedFile.js';

const files: ExportedFile[] = [
  { kind: 'text', path: 'content/a/index.md', content: 'one' },
  { kind: 'image', path: 'content/a/x.png', hash: 'h1' },
];

describe('fingerprintExport', () => {
  it('is stable and changes with any path or content', () => {
    expect(fingerprintExport(files)).toBe(fingerprintExport(structuredClone(files)));
    expect(fingerprintExport(files)).not.toBe(
      fingerprintExport([{ kind: 'text', path: 'content/a/index.md', content: 'two' }, files[1]!]),
    );
    expect(fingerprintExport(files)).not.toBe(
      fingerprintExport([files[0]!, { kind: 'image', path: 'content/a/x.png', hash: 'h2' }]),
    );
  });
});
