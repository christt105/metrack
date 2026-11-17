import { describe, expect, it } from 'vitest';
import {
  describeViewing,
  formIsValid,
  newestFirst,
  viewingFromForm,
  withReplaced,
  withViewing,
  withoutViewing,
} from '../src/logic/viewingEdits';

const closed = [
  { startedAt: null, finishedAt: '2024-01-01' },
  { startedAt: '2025-02-01', finishedAt: '2025-02-03' },
];
const open = { startedAt: '2026-05-01', finishedAt: null };

describe('viewingEdits', () => {
  it('lists the open viewing first, then the newest finish', () => {
    expect(newestFirst([...closed, open])).toEqual([open, closed[1], closed[0]]);
  });

  it('describes viewings without em dashes and with placeholders', () => {
    expect(describeViewing(closed[0]!)).toBe('? - 2024-01-01');
    expect(describeViewing(closed[1]!)).toBe('2025-02-01 - 2025-02-03');
    expect(describeViewing(open)).toBe('Watching since 2026-05-01');
    expect(describeViewing({ startedAt: null, finishedAt: null })).toBe('Watching, no start date');
  });

  it('turns empty form fields into missing dates', () => {
    expect(viewingFromForm('', '2026-01-01')).toEqual({
      startedAt: null,
      finishedAt: '2026-01-01',
    });
    expect(viewingFromForm('2026-01-01', '')).toEqual({
      startedAt: '2026-01-01',
      finishedAt: null,
    });
  });

  it('adds, replaces and removes by position in the displayed list', () => {
    expect(withViewing(closed, open)).toEqual([...closed, open]);
    expect(
      withReplaced([...closed, open], 2, { startedAt: '2023-12-30', finishedAt: '2024-01-01' })[0],
    ).toEqual({
      startedAt: '2023-12-30',
      finishedAt: '2024-01-01',
    });
    expect(withoutViewing([...closed, open], 0)).toEqual(closed);
    expect(withoutViewing(closed, 1)).toEqual([closed[1]]);
  });

  it('requires an end for closed viewings and an end not before the start', () => {
    expect(formIsValid('', '', true)).toBe(false);
    expect(formIsValid('2026-01-01', '', false)).toBe(true);
    expect(formIsValid('2026-02-01', '2026-01-01', true)).toBe(false);
    expect(formIsValid('', '2026-01-01', true)).toBe(true);
  });
});
