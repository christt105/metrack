import type { SeasonEpisodeItem, SeasonEpisodesUpdateResponse, Season } from '@metrack/domain';
import { describe, expect, it } from 'vitest';
import {
  doneOrSkipped,
  hasAired,
  hasDatedViewing,
  isDone,
  openRewatchStart,
  unwatchedAired,
  watchedTodayKeys,
} from '../src/logic/episodeSelection';
import { inverseOperations } from '../src/logic/inverseOperations';
import { stillUrl } from '../src/logic/stillUrl';
import { withTracking } from '../src/logic/withTracking';

const episode = (number: number, patch: Partial<SeasonEpisodeItem> = {}): SeasonEpisodeItem => ({
  key: `k${number}`,
  number,
  tmdbId: 100 + number,
  title: null,
  airDate: '2026-01-01',
  runtime: null,
  overview: null,
  stillPath: null,
  watched: false,
  skipped: false,
  viewings: [],
  filler: null,
  ...patch,
});
const today = '2026-06-01';
const viewing = { startedAt: null, finishedAt: '2026-02-02' };

describe('unwatchedAired', () => {
  const episodes = [
    episode(1, { watched: true, viewings: [viewing] }),
    episode(2),
    episode(3, { airDate: null }),
    episode(4),
    episode(5, { airDate: '2026-06-02' }),
  ];

  it('lists every unwatched aired episode', () => {
    expect(unwatchedAired(episodes, today)).toEqual(['k2', 'k3', 'k4']);
  });

  it('stops at the chosen episode and skips watched and unaired ones', () => {
    expect(unwatchedAired(episodes, today, 'k3')).toEqual(['k2', 'k3']);
    expect(unwatchedAired(episodes, today, 'k5')).toEqual(['k2', 'k3', 'k4']);
    expect(unwatchedAired(episodes, today, 'k1')).toEqual([]);
  });

  it('treats an episode aired today as aired and a missing date as aired', () => {
    expect(hasAired(episode(1, { airDate: today }), today)).toBe(true);
    expect(hasAired(episode(1, { airDate: null }), today)).toBe(true);
    expect(hasAired(episode(1, { airDate: '2026-06-02' }), today)).toBe(false);
  });
});

describe('episode selection with skipped episodes and rewatches', () => {
  const dated = { startedAt: '2026-05-02', finishedAt: '2026-05-02' };
  const episodes = [
    episode(1, { watched: true, viewings: [viewing, dated] }),
    episode(2, { watched: true, viewings: [viewing] }),
    episode(3, { skipped: true }),
    episode(4),
  ];

  it('never selects a skipped episode', () => {
    expect(unwatchedAired(episodes, today)).toEqual(['k4']);
  });

  it('reads an open rewatch start and counts viewings since it', () => {
    expect(openRewatchStart([viewing, { startedAt: '2026-05-01', finishedAt: null }])).toBe(
      '2026-05-01',
    );
    expect(openRewatchStart([viewing])).toBeNull();
    expect(isDone(episodes[0]!, '2026-05-01')).toBe(true);
    expect(isDone(episodes[1]!, '2026-05-01')).toBe(false);
    expect(isDone(episodes[2]!)).toBe(false);
    expect(doneOrSkipped(episodes, '2026-05-01')).toBe(2);
    expect(unwatchedAired(episodes, today, undefined, '2026-05-01')).toEqual(['k2', 'k4']);
  });

  it('watched today covers the pending episodes, or every unskipped aired one when none is pending', () => {
    expect(watchedTodayKeys(episodes, today)).toEqual(['k4']);
    const finished = [episodes[0]!, episodes[1]!, episodes[2]!];
    expect(watchedTodayKeys(finished, today)).toEqual(['k1', 'k2']);
    expect(watchedTodayKeys(finished, today, '2026-06-01')).toEqual(['k1', 'k2']);
    expect(watchedTodayKeys([episodes[0]!, episodes[2]!], today, '2026-05-01')).toEqual([]);
  });

  it('knows whether an episode has a dated viewing', () => {
    expect(hasDatedViewing(episodes[0]!)).toBe(true);
    expect(hasDatedViewing(episode(5, { watched: true, viewings: [] }))).toBe(false);
  });
});

describe('inverseOperations', () => {
  const before = [
    episode(1, { watched: true, viewings: [viewing] }),
    episode(2),
    episode(3, { watched: true, viewings: [] }),
  ];

  it('unmarks only the episodes a mark added', () => {
    expect(inverseOperations({ op: 'mark', keys: ['k1', 'k2'], date: today }, before)).toEqual([
      { op: 'unmark', keys: ['k2'] },
      { op: 'setViewings', key: 'k1', viewings: [viewing] },
    ]);
    expect(inverseOperations({ op: 'mark', keys: ['k1'], date: today }, before)).toEqual([
      { op: 'setViewings', key: 'k1', viewings: [viewing] },
    ]);
  });

  it('skips again the episodes a mark unskipped', () => {
    const skipped = [episode(1, { skipped: true }), episode(2)];
    expect(inverseOperations({ op: 'mark', keys: ['k1', 'k2'], date: today }, skipped)).toEqual([
      { op: 'unmark', keys: ['k2'] },
      { op: 'skip', keys: ['k1'] },
    ]);
  });

  it('undoes a skip by unskipping and putting back an undated watch it removed', () => {
    const state = [episode(1, { watched: true, viewings: [] }), episode(2)];
    expect(inverseOperations({ op: 'skip', keys: ['k1', 'k2'] }, state)).toEqual([
      { op: 'setViewings', key: 'k1', viewings: [] },
      { op: 'unskip', keys: ['k2'] },
    ]);
  });

  it('undoes an unskip by skipping again', () => {
    const state = [episode(1, { skipped: true }), episode(2)];
    expect(inverseOperations({ op: 'unskip', keys: ['k1', 'k2'] }, state)).toEqual([
      { op: 'skip', keys: ['k1'] },
    ]);
  });

  it('restores the viewings an unmark removed', () => {
    expect(inverseOperations({ op: 'unmark', keys: ['k1', 'k2', 'k3'] }, before)).toEqual([
      { op: 'setViewings', key: 'k1', viewings: [viewing] },
      { op: 'setViewings', key: 'k3', viewings: [] },
    ]);
  });

  it('restores the previous viewings of an edited episode', () => {
    expect(inverseOperations({ op: 'setViewings', key: 'k1', viewings: [] }, before)).toEqual([
      { op: 'setViewings', key: 'k1', viewings: [viewing] },
    ]);
  });
});

describe('withTracking', () => {
  it('copies the status, dates and watched count', () => {
    const season = {
      id: 1,
      status: 'planned',
      startedAt: null,
      watchedCount: 0,
    } as unknown as Season;
    const update = {
      watchedCount: 4,
      tracking: { status: 'in_progress', startedAt: '2026-03-01', finishedAt: null, rewatches: [] },
    } as unknown as SeasonEpisodesUpdateResponse;
    expect(withTracking(season, update)).toMatchObject({
      id: 1,
      status: 'in_progress',
      startedAt: '2026-03-01',
      watchedCount: 4,
    });
  });
});

describe('stillUrl', () => {
  it('builds the TMDB image address and ignores a missing or odd path', () => {
    expect(stillUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w300/abc.jpg');
    expect(stillUrl(null)).toBeNull();
    expect(stillUrl('abc.jpg')).toBeNull();
  });
});
