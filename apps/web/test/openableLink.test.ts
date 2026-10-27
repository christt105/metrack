import { describe, expect, it } from 'vitest';
import { openableLink } from '../src/logic/openableLink';

describe('openableLink', () => {
  it('accepts Obsidian and web URLs', () => {
    expect(openableLink(' obsidian://open?vault=Atlas&file=Heat ')).toBe(
      'obsidian://open?vault=Atlas&file=Heat',
    );
    expect(openableLink('https://example.com/notes/heat')).toBe('https://example.com/notes/heat');
  });

  it('rejects other schemes, plain text and empty values', () => {
    expect(openableLink('javascript:alert(1)')).toBeNull();
    expect(openableLink('file:///etc/passwd')).toBeNull();
    expect(openableLink('Heat notes')).toBeNull();
    expect(openableLink('')).toBeNull();
    expect(openableLink(null)).toBeNull();
  });
});
