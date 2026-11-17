import { describe, expect, it } from 'vitest';
import { finishDates, normalizeViewings, viewingsFromDates } from '../src/index.js';

describe('normalizeViewings', () => {
  it('sorts closed viewings by finish then start and removes duplicates', () => {
    expect(
      normalizeViewings([
        { startedAt: null, finishedAt: '2026-05-01' },
        { startedAt: '2026-01-01', finishedAt: '2026-03-01' },
        { startedAt: null, finishedAt: '2026-05-01' },
        { startedAt: '2026-04-01', finishedAt: '2026-05-01' },
      ]),
    ).toEqual([
      { startedAt: '2026-01-01', finishedAt: '2026-03-01' },
      { startedAt: null, finishedAt: '2026-05-01' },
      { startedAt: '2026-04-01', finishedAt: '2026-05-01' },
    ]);
  });

  it('drops a start after its finish', () => {
    expect(normalizeViewings([{ startedAt: '2026-06-01', finishedAt: '2026-05-01' }])).toEqual([
      { startedAt: null, finishedAt: '2026-05-01' },
    ]);
  });

  it('keeps one open viewing, the latest started, always last', () => {
    expect(
      normalizeViewings([
        { startedAt: '2026-02-01', finishedAt: null },
        { startedAt: '2026-08-01', finishedAt: null },
        { startedAt: null, finishedAt: '2026-09-01' },
      ]),
    ).toEqual([
      { startedAt: null, finishedAt: '2026-09-01' },
      { startedAt: '2026-08-01', finishedAt: null },
    ]);
  });
});

describe('finishDates and viewingsFromDates', () => {
  it('round-trips finish dates and skips open viewings', () => {
    const viewings = viewingsFromDates(['2026-05-01', '2026-03-01', '2026-05-01']);
    expect(finishDates([...viewings, { startedAt: '2026-06-01', finishedAt: null }])).toEqual([
      '2026-03-01',
      '2026-05-01',
    ]);
  });
});
