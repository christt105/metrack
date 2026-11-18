import type { SeasonEpisodeItem, SeasonEpisodesUpdateResponse, Season } from '@metrack/domain';
import { describe, expect, it } from 'vitest';
import { hasAired, unwatchedAired } from '../src/logic/episodeSelection';
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
  viewings: [],
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

describe('inverseOperations', () => {
  const before = [
    episode(1, { watched: true, viewings: [viewing] }),
    episode(2),
    episode(3, { watched: true, viewings: [] }),
  ];

  it('unmarks only the episodes a mark added', () => {
    expect(inverseOperations({ op: 'mark', keys: ['k1', 'k2'], date: today }, before)).toEqual([
      { op: 'unmark', keys: ['k2'] },
    ]);
    expect(inverseOperations({ op: 'mark', keys: ['k1'], date: today }, before)).toEqual([]);
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
