import { describe, expect, it } from 'vitest';
import { hashContent } from '../src/metadata/hashContent.js';

describe('hashContent', () => {
  it('ignores key order and undefined values', () => {
    expect(hashContent({ a: 1, b: { c: [1, 2], d: null } })).toBe(
      hashContent({ b: { d: null, c: [1, 2] }, a: 1, z: undefined }),
    );
  });

  it('changes when content changes', () => {
    expect(hashContent({ a: [1, 2] })).not.toBe(hashContent({ a: [2, 1] }));
  });
});
