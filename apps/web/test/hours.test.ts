import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/messages/en';
import { fieldSchemas } from '../src/logic/fieldSchemas';
import { formatDuration } from '../src/logic/formatDuration';
import { formatHoursInput } from '../src/logic/formatHoursInput';
import { buildPatch, DraftError, toDraft } from '../src/logic/formDraft';
import { hoursChange } from '../src/logic/quickChanges';
import { parseHours } from '../src/logic/parseHours';
import { readDetailFacts } from '../src/logic/readDetailFacts';
import type { AnyDetail } from '../src/api/AnyDetail';

describe('parseHours', () => {
  it('reads decimals with a point or a comma and h:mm into minutes', () => {
    expect(parseHours('12.5')).toBe(750);
    expect(parseHours('12,5')).toBe(750);
    expect(parseHours('12:30')).toBe(750);
    expect(parseHours('0:05')).toBe(5);
    expect(parseHours('0')).toBe(0);
    expect(parseHours(' 3 ')).toBe(180);
    expect(parseHours('0.25')).toBe(15);
  });

  it('treats blank as no data and rejects everything else', () => {
    expect(parseHours('')).toBeNull();
    expect(parseHours('   ')).toBeNull();
    for (const bad of ['abc', '-1', '1:75', '1:2:3', '12h', '1e3', '100001', '100000:01']) {
      expect(parseHours(bad), bad).toBeUndefined();
    }
    expect(parseHours('100000')).toBe(6_000_000);
  });
});

describe('formatting', () => {
  it('writes the input text and the readable duration', () => {
    expect(formatHoursInput(750)).toBe('12:30');
    expect(formatHoursInput(720)).toBe('12');
    expect(formatHoursInput(5)).toBe('0:05');
    expect(formatHoursInput(0)).toBe('0');
    expect(parseHours(formatHoursInput(1))).toBe(1);
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(720)).toBe('12 h');
    expect(formatDuration(750)).toBe('12 h 30 min');
  });
});

describe('the hours field of the edit form', () => {
  const game = { id: 1, timeSpentMinutes: 750, title: 'Hades' };
  const schemas = fieldSchemas.games;

  it('is offered for games and books only', () => {
    expect(fieldSchemas.games.some((s) => s.key === 'timeSpentMinutes')).toBe(true);
    expect(fieldSchemas.books.some((s) => s.key === 'timeSpentMinutes')).toBe(true);
    expect(fieldSchemas.movies.some((s) => s.key === 'timeSpentMinutes')).toBe(false);
  });

  it('shows minutes as hours and sends minutes back', () => {
    const draft = toDraft(schemas, game);
    expect(draft.timeSpentMinutes).toBe('12:30');
    expect(buildPatch(schemas, game, draft, en)).toEqual({});
    expect(buildPatch(schemas, game, { ...draft, timeSpentMinutes: '13.5' }, en)).toEqual({
      timeSpentMinutes: 810,
    });
    expect(buildPatch(schemas, game, { ...draft, timeSpentMinutes: '' }, en)).toEqual({
      timeSpentMinutes: null,
    });
  });

  it('refuses text that is not hours', () => {
    const draft = toDraft(schemas, game);
    expect(() => buildPatch(schemas, game, { ...draft, timeSpentMinutes: 'lots' }, en)).toThrow(
      DraftError,
    );
  });
});

describe('the quick hours change', () => {
  it('patches the minutes and undoes to the previous value', () => {
    expect(hoursChange(60, 90)).toEqual({
      patch: { timeSpentMinutes: 90 },
      undo: { timeSpentMinutes: 60 },
    });
    expect(hoursChange(null, 90).undo).toEqual({ timeSpentMinutes: null });
  });
});

describe('the time shown on a detail page', () => {
  const movie = (extra: object) =>
    ({
      id: 1,
      title: 'Heat',
      status: 'completed',
      finishedAt: '2025-01-01',
      rewatches: [{ startedAt: null, finishedAt: '2026-01-01' }],
      runtime: 170,
      genres: [],
      cast: [],
      ...extra,
    }) as unknown as AnyDetail;

  it('computes a movie from its runtime and finished rewatches', () => {
    expect(readDetailFacts(movie({}))).toMatchObject({
      timeSpentMinutes: 340,
      durationUnknown: false,
    });
  });

  it('says a completed movie has no duration when TMDB gave none', () => {
    expect(readDetailFacts(movie({ runtime: null }))).toMatchObject({
      timeSpentMinutes: null,
      durationUnknown: true,
    });
    expect(readDetailFacts(movie({ runtime: 0 })).durationUnknown).toBe(true);
    expect(readDetailFacts(movie({ runtime: null, status: 'planned' })).durationUnknown).toBe(
      false,
    );
  });

  it('takes the typed hours of games and the computed ones of series', () => {
    const game = {
      id: 1,
      title: 'Hades',
      timeSpentMinutes: 90,
      genres: [],
    } as unknown as AnyDetail;
    expect(readDetailFacts(game).timeSpentMinutes).toBe(90);
    const series = {
      id: 1,
      title: 'Lupin',
      timeSpentMinutes: null,
      genres: [],
    } as unknown as AnyDetail;
    expect(readDetailFacts(series).timeSpentMinutes).toBeNull();
  });
});
