# Steam import

Imports the games of a Steam account into the library, on demand. There is no scheduled job.

## Setup

- The server needs `STEAM_API_KEY`, a free Steam Web API key (https://steamcommunity.com/dev/apikey), and the IGDB credentials (`IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`), which match Steam games to IGDB and add them. Without either, the Steam panel in Settings says the import is off and the routes answer 501. At home it is an environment variable; on the Worker it is a secret (`npx wrangler secret put STEAM_API_KEY`, see [worker.md](worker.md)). The key is only sent to Steam and is never logged or returned.
- Each user links their own account under Settings, Steam: a SteamID64, a profile address (`steamcommunity.com/profiles/<id>` or `steamcommunity.com/id/<name>`) or a bare custom profile name. A name is resolved through Steam and the SteamID64 is stored in the user's settings.
- The profile and its "Game details" must be public while importing. When Steam returns no games the import says the profile or its Game details are private (or the account owns none).

## What the report shows

"Check my library" reads the owned games (`IPlayerService/GetOwnedGames`, with free games and names) and sorts them by Steam app id. Nothing is written.

- Games already in your library are matched by their Steam app id (or by the IGDB id when only that was stored). When Steam's `playtime_forever` is greater than the stored time, the row proposes a time update; the time is never lowered, and a missing time counts as 0. Games already at least as long are only counted as up to date.
- Games the shared catalog already has, or that IGDB links to the Steam app (`external_games`, source Steam), are proposed as additions. Games IGDB does not know are listed as not importable.
- Proposed status: time played in the last two weeks is "In progress", any other played game is "Paused", and never played games are "Planned" and start unselected; a checkbox includes them. Steam dates are not copied to the start or finish dates: the last played date is only shown in the report.
- Added games get their time spent from Steam's total playtime.

## Applying

Select the rows (all, none, or one by one; every played row and every time update starts selected) and import. The browser sends the chosen app ids in batches of up to 10 with a progress bar. The server recomputes what each id does from Steam's current answer, so only the ids come from the browser, and repeating an import writes nothing new.

On the Worker's free plan one request may make at most 50 subrequests, counting every fetch, D1 statement or batch and R2 operation. Measured by `steamWorkerBudget.test.ts` over D1 and R2: a request costs about 8 to 10 subrequests before writing anything, raising a stored time costs 3 more per game, adding a game the catalog already has costs 3, and adding a game from IGDB costs 5. The server therefore stops a request when the next game would not fit and answers those games as `deferred`; the browser sends them again first. In practice a request takes 8 new IGDB games (it took 2 when the import also archived the images), or all 10 time updates or catalog additions. On the home server the same code runs with the same batches.

## Artwork

A new IGDB game is added with its artwork deferred, which is what makes it cheap: the game keeps the linked URLs (the Steam library cover and hero, or the IGDB cover and first screenshot when IGDB has no Steam app for it), has no SteamGridDB id yet and is marked `artwork_pending` in the shared catalog. Nothing is fetched for the images while importing.

`GameArtworkBackfill` finishes those games: it archives the cover and banner (`ImageStore.archive`), looks up the SteamGridDB id and clears the flag. When a Steam image cannot be fetched (Steam has no library art for some apps) the IGDB cover or first screenshot replaces it, asking IGDB for the game by its id only then, exactly as a normal add does. Every game is attempted once: the flag is always cleared afterwards, so a game that keeps failing never holds the queue. An image that neither Steam nor IGDB could provide is left empty, an IGDB image that could not be archived stays linked (the archive is only a copy), and the artwork picker can still choose another one. A database failure is not swallowed: the game stays pending and the next run tries it again.

One run prepares as many games as fit in a subrequest budget, using the measured cost of a game (`GAME_ARTWORK_COST`: 12 with Steam art, 19 when it falls back to IGDB, measured by `steamWorkerBudget.test.ts`, which also checks that a request never passes 50): about 2 games per request on the Worker's free plan. It runs from:

- `POST /api/steam/artwork`, which the web app calls in a loop right after an import finishes, showing "Preparing artwork, N left" in the same page until none remain. It only prepares games in the caller's library and answers `{ processed, remaining }`.
- The hourly scheduled tick of the Worker, only when the tick had no account to erase and no movie runtime to fill in, with a smaller budget so it stays inside its own 50 subrequests.
- The home server, at start and then hourly, with a budget large enough for many games at once (no subrequest limit there).

So leftovers (a closed tab, a failed request) finish on their own without the user doing anything.

## Achievements

Steam achievements are stored per game of the user's library that has a Steam app id, from `ISteamUserStats/GetPlayerAchievements` with the same `STEAM_API_KEY` and the stored SteamID64. The list it answers holds every achievement of the game with whether the player unlocked it and when, so one request per game gives the total, the unlocked count and the date of the latest unlock, with no schema request. Like the import, it needs the profile's Game details to be public.

Each library entry has `achievements_unlocked`, `achievements_total`, `achievements_last_unlocked_at` (a `YYYY-MM-DD` date) and `achievements_checked_at` (migration 36, D1 `0019_steam_achievements.sql`), exposed on games as `achievementsUnlocked`, `achievementsTotal`, `achievementsLastUnlockedAt` and `achievementsCheckedAt`. What they mean:

- Total `null`: unknown. The game was never checked or every check failed. It is shown as "Not checked yet".
- Total 0 (unlocked 0): Steam says the game has no achievements or no stats (a 400 "Requested app has no stats", or a list with no achievements). It is shown as "This game has no achievements" and is never complete.
- Total N above 0: "unlocked of N".
- A failed request (private game details, a Steam error, a malformed answer) never writes counts, so it cannot turn into "0 of N" or into a complete game; the previous counts stay and only `achievements_checked_at` is stamped.

Anything that wants "all achievements" must require a total above 0 and unlocked equal to total.

`POST /api/steam/achievements` refreshes them in batches from the browser, in a pass: the first request has no `asOf` and the server answers one, the browser sends it back, and a pass checks the games not checked since then (every game asked is stamped, answered or not, so it always ends). Games with playtime go first. Measured by `steamWorkerBudget.test.ts`, a request costs 5 subrequests before checking anything and each game 4 (the Steam request and the write of its entry), so `STEAM_ACHIEVEMENTS_BUDGET` allows 11 games per request on the Worker's free plan (49 measured) and a library of a few hundred games takes a few dozen requests. The game detail page has a button for one game, and Settings, Steam has one for all of them, both with a progress indicator. There is no scheduled refresh: the hourly Worker tick and the home server do not call it.
