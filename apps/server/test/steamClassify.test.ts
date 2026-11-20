import { describe, expect, it } from 'vitest';
import { classifySteamGames } from '../src/steam/classifySteamGames.js';
import type { SteamOwnedGame } from '../src/providers/steam/SteamOwnedGame.js';
import type { SteamLibraryEntry } from '../src/steam/SteamLibraryEntry.js';

const game = (appid: number, extra: Partial<SteamOwnedGame> = {}): SteamOwnedGame => ({
  appid,
  name: `Game ${appid}`,
  playtime_forever: 0,
  ...extra,
});
const entry = (
  id: number,
  steamAppId: string | null,
  minutes: number | null,
  igdbId = null as number | null,
): SteamLibraryEntry => ({
  id,
  steamAppId,
  igdbId,
  timeSpentMinutes: minutes,
});

describe('classifySteamGames', () => {
  it('raises the time of a game in the library only when Steam has more', () => {
    const { report, targets } = classifySteamGames(
      [
        game(1, { playtime_forever: 500 }),
        game(2, { playtime_forever: 600 }),
        game(3, { playtime_forever: 700 }),
        game(4, { playtime_forever: 10 }),
        game(5, { playtime_forever: 0 }),
      ],
      [
        entry(11, '1', 100),
        entry(12, '2', 900),
        entry(13, '3', 700),
        entry(14, '4', null),
        entry(15, '5', null),
      ],
      [],
      new Map(),
    );
    expect(report.rows.map((row) => row.appId).sort()).toEqual(['1', '4']);
    expect(report.rows.find((row) => row.appId === '1')).toMatchObject({
      action: 'update',
      source: 'library',
      storedMinutes: 100,
      playtimeMinutes: 500,
      status: null,
      selected: true,
    });
    expect(report.rows.find((row) => row.appId === '4')?.storedMinutes).toBeNull();
    expect(report.upToDate).toBe(3);
    expect(targets.get('1')).toEqual({ kind: 'update', entryId: 11, minutes: 500 });
    expect(targets.has('2')).toBe(false);
  });

  it('imports games from the catalog and from IGDB with a proposed status', () => {
    const { report, targets } = classifySteamGames(
      [
        game(20, { playtime_forever: 300, playtime_2weeks: 30, rtime_last_played: 1_700_000_000 }),
        game(21, { playtime_forever: 200 }),
        game(22, { playtime_forever: 0 }),
      ],
      [],
      [{ steamAppId: '20', igdbId: 2000, title: 'Catalog Game' }],
      new Map([
        ['21', 2100],
        ['22', 2200],
      ]),
    );
    const byId = Object.fromEntries(report.rows.map((row) => [row.appId, row]));
    expect(byId['20']).toMatchObject({
      action: 'import',
      source: 'catalog',
      status: 'in_progress',
      selected: true,
      recentMinutes: 30,
      lastPlayedAt: '2023-11-14T22:13:20.000Z',
    });
    expect(byId['21']).toMatchObject({
      source: 'igdb',
      status: 'paused',
      selected: true,
      lastPlayedAt: null,
    });
    expect(byId['22']).toMatchObject({ source: 'igdb', status: 'planned', selected: false });
    expect(targets.get('20')).toEqual({ kind: 'catalog', igdbId: 2000, title: 'Catalog Game' });
    expect(targets.get('21')).toEqual({ kind: 'igdb', igdbId: 2100 });
  });

  it('lists games IGDB does not know as unmatched and never importable', () => {
    const { report, targets } = classifySteamGames(
      [game(30, { playtime_forever: 5 })],
      [],
      [],
      new Map(),
    );
    expect(report.rows).toEqual([]);
    expect(report.unmatched).toEqual([{ appId: '30', name: 'Game 30', playtimeMinutes: 5 }]);
    expect(targets.size).toBe(0);
  });

  it('finds a library game by IGDB id when its Steam app id was never stored', () => {
    const { report, targets } = classifySteamGames(
      [game(40, { playtime_forever: 90 })],
      [entry(41, null, 10, 4000)],
      [],
      new Map([['40', 4000]]),
    );
    expect(report.rows[0]).toMatchObject({ action: 'update', storedMinutes: 10 });
    expect(targets.get('40')).toEqual({ kind: 'update', entryId: 41, minutes: 90 });
  });

  it('orders rows by time played and counts the owned games', () => {
    const { report } = classifySteamGames(
      [game(50, { playtime_forever: 1 }), game(51, { playtime_forever: 9 })],
      [],
      [],
      new Map([
        ['50', 1],
        ['51', 2],
      ]),
    );
    expect(report.rows.map((row) => row.appId)).toEqual(['51', '50']);
    expect(report.owned).toBe(2);
  });
});
