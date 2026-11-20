import type { MediaStatus, SteamImportRow, SteamUnmatchedGame } from '@metrack/domain';
import type { SteamOwnedGame } from '../providers/steam/SteamOwnedGame.js';
import type { CatalogSteamGame } from '../storage/repositories/CatalogSteamGame.js';
import type { SteamClassification } from './SteamClassification.js';
import type { SteamImportTarget } from './SteamImportTarget.js';
import type { SteamLibraryEntry } from './SteamLibraryEntry.js';

function proposedStatus(game: SteamOwnedGame): MediaStatus {
  if ((game.playtime_2weeks ?? 0) > 0) return 'in_progress';
  return (game.playtime_forever ?? 0) > 0 ? 'paused' : 'planned';
}

function lastPlayed(game: SteamOwnedGame): string | null {
  return game.rtime_last_played ? new Date(game.rtime_last_played * 1000).toISOString() : null;
}

/**
 * Sorts the games a Steam account owns into what the import can do with each. A game already in the library is
 * matched by its Steam app id, or by the IGDB id the catalog or IGDB gives for the app; its stored time is raised
 * to Steam's when Steam's is greater and never lowered. Other games the shared catalog or IGDB knows are imported;
 * the rest are listed as unmatched. Games never played start unselected.
 */
export function classifySteamGames(
  owned: readonly SteamOwnedGame[],
  library: readonly SteamLibraryEntry[],
  catalog: readonly CatalogSteamGame[],
  igdbMatches: ReadonlyMap<string, number>,
): SteamClassification {
  const bySteam = new Map(
    library.flatMap((e) => (e.steamAppId ? [[e.steamAppId, e] as const] : [])),
  );
  const byIgdb = new Map(library.flatMap((e) => (e.igdbId ? [[e.igdbId, e] as const] : [])));
  const inCatalog = new Map(catalog.map((game) => [game.steamAppId, game]));
  const rows: SteamImportRow[] = [];
  const unmatched: SteamUnmatchedGame[] = [];
  const targets = new Map<string, SteamImportTarget>();
  let upToDate = 0;

  for (const game of owned) {
    const appId = String(game.appid);
    if (targets.has(appId)) continue;
    const name = game.name?.trim() || `Steam app ${appId}`;
    const minutes = game.playtime_forever ?? 0;
    const catalogGame = inCatalog.get(appId);
    const igdbId = catalogGame?.igdbId ?? igdbMatches.get(appId) ?? null;
    const entry = bySteam.get(appId) ?? (igdbId === null ? undefined : byIgdb.get(igdbId));
    const base = {
      appId,
      name,
      playtimeMinutes: minutes,
      recentMinutes: game.playtime_2weeks ?? 0,
      lastPlayedAt: lastPlayed(game),
    };

    if (entry) {
      if (minutes > (entry.timeSpentMinutes ?? 0)) {
        rows.push({
          ...base,
          action: 'update',
          source: 'library',
          storedMinutes: entry.timeSpentMinutes,
          status: null,
          selected: true,
        });
        targets.set(appId, { kind: 'update', entryId: entry.id, minutes });
      } else {
        upToDate += 1;
      }
      continue;
    }
    if (igdbId === null) {
      unmatched.push({ appId, name, playtimeMinutes: minutes });
      continue;
    }
    rows.push({
      ...base,
      action: 'import',
      source: catalogGame ? 'catalog' : 'igdb',
      storedMinutes: null,
      status: proposedStatus(game),
      selected: minutes > 0,
    });
    targets.set(
      appId,
      catalogGame
        ? { kind: 'catalog', igdbId, title: catalogGame.title }
        : { kind: 'igdb', igdbId },
    );
  }

  const order = (a: { playtimeMinutes: number; name: string }, b: typeof a): number =>
    b.playtimeMinutes - a.playtimeMinutes || a.name.localeCompare(b.name);
  rows.sort(order);
  unmatched.sort(order);
  return { report: { owned: owned.length, rows, upToDate, unmatched }, targets };
}
