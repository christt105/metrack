import { describe, expect, it } from 'vitest';
import { statusOptions } from '../src/logic/statusOptions';

describe('statusOptions', () => {
  it('offers the current status and only the valid moves', () => {
    expect(statusOptions('completed')).toEqual(['in_progress', 'completed']);
    expect(statusOptions('dropped')).toEqual(['planned', 'in_progress', 'dropped']);
  });
});
