import { describe, expect, it } from 'vitest';
import { handleProblem } from '@metrack/domain';
import { suggestHandle } from '../src/logic/suggestHandle';

describe('suggestHandle', () => {
  it.each([
    ['Ana García', 'ana-garcia'],
    ['  Zoë  Smith-Jones ', 'zoe-smith-jones'],
    ['J. R. R.', 'j-r-r'],
    ['!!!', ''],
  ])('turns %j into %j', (name, handle) => {
    expect(suggestHandle(name)).toBe(handle);
  });

  it('keeps long names within the handle limit', () => {
    const handle = suggestHandle('a'.repeat(50));
    expect(handle).toHaveLength(30);
    expect(handleProblem(handle)).toBeNull();
  });
});
