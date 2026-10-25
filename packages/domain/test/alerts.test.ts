import { describe, expect, it } from 'vitest';
import {
  checkIntervalMinutes,
  FREQUENT_CHECK_MINUTES,
  IDLE_CHECK_MINUTES,
  planReleaseAlerts,
  WAITING_CHECK_MINUTES,
  type AlertCandidate,
  type AlertKey,
} from '../src/index.js';

const TODAY = '2026-10-23';

function season(releaseDate: string | null, flatrateEs = false, id = 1): AlertCandidate {
  return { subjectType: 'season', subjectId: id, releaseDate, flatrateEs };
}

const kinds = (due: AlertKey[]): string[] => due.map((d) => d.kind);

describe('planReleaseAlerts', () => {
  it('announces a release the day before', () => {
    expect(kinds(planReleaseAlerts([season('2026-10-24')], [], TODAY))).toEqual([
      'releases_tomorrow',
    ]);
  });

  it('announces a release on the day', () => {
    expect(kinds(planReleaseAlerts([season('2026-10-23')], [], TODAY))).toEqual(['releases_today']);
  });

  it('reports availability together with the release day when the provider is already listed', () => {
    expect(kinds(planReleaseAlerts([season('2026-10-23', true)], [], TODAY))).toEqual([
      'releases_today',
      'available_es',
    ]);
  });

  it('does not alert for dates further away or without a date', () => {
    expect(planReleaseAlerts([season('2026-10-30'), season(null, true)], [], TODAY)).toEqual([]);
  });

  it('never sends a late "tomorrow" or "today"', () => {
    expect(planReleaseAlerts([season('2026-10-22')], [], TODAY)).toEqual([]);
  });

  it('announces availability after the release only inside the window', () => {
    expect(kinds(planReleaseAlerts([season('2026-10-20', true)], [], TODAY))).toEqual([
      'available_es',
    ]);
    expect(planReleaseAlerts([season('2026-08-01', true)], [], TODAY)).toEqual([]);
    expect(
      kinds(
        planReleaseAlerts(
          [{ subjectType: 'movie', subjectId: 1, releaseDate: '2026-09-01', flatrateEs: true }],
          [],
          TODAY,
        ),
      ),
    ).toEqual(['available_es']);
  });

  it('ignores a provider listing for a release that has not happened', () => {
    expect(planReleaseAlerts([season('2026-11-20', true)], [], TODAY)).toEqual([]);
  });

  it('skips what was already sent for the same subject and kind only', () => {
    const sent: AlertKey[] = [{ subjectType: 'season', subjectId: 1, kind: 'releases_today' }];
    expect(planReleaseAlerts([season('2026-10-23')], sent, TODAY)).toEqual([]);
    expect(kinds(planReleaseAlerts([season('2026-10-23', true)], sent, TODAY))).toEqual([
      'available_es',
    ]);
    expect(kinds(planReleaseAlerts([season('2026-10-23', false, 2)], sent, TODAY))).toEqual([
      'releases_today',
    ]);
  });
});

describe('checkIntervalMinutes', () => {
  it('asks often from the day before to the day after the release', () => {
    for (const date of ['2026-10-24', '2026-10-23', '2026-10-22']) {
      expect(checkIntervalMinutes('season', date, TODAY)).toBe(FREQUENT_CHECK_MINUTES);
    }
  });

  it('keeps asking every few hours while providers may be late', () => {
    expect(checkIntervalMinutes('season', '2026-10-15', TODAY)).toBe(WAITING_CHECK_MINUTES);
    expect(checkIntervalMinutes('movie', '2026-09-20', TODAY)).toBe(WAITING_CHECK_MINUTES);
  });

  it('asks rarely when nothing is near', () => {
    expect(checkIntervalMinutes('season', null, TODAY)).toBe(IDLE_CHECK_MINUTES);
    expect(checkIntervalMinutes('season', '2026-12-01', TODAY)).toBe(IDLE_CHECK_MINUTES);
    expect(checkIntervalMinutes('season', '2026-01-01', TODAY)).toBe(IDLE_CHECK_MINUTES);
  });
});
