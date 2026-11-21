import { describe, expect, it } from 'vitest';
import { loadCustomPlatforms, rememberCustomPlatform } from '../src/logic/customPlatforms';

function memory(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('custom platforms', () => {
  it('remembers each one once and loads them back', () => {
    const storage = memory();
    rememberCustomPlatform('Amiga', storage);
    rememberCustomPlatform('Amiga', storage);
    rememberCustomPlatform('Atari', storage);
    expect(loadCustomPlatforms(storage)).toEqual(['Amiga', 'Atari']);
  });

  it('ignores a corrupt stored value', () => {
    expect(loadCustomPlatforms({ getItem: () => 'nope' })).toEqual([]);
  });
});
