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

On the Worker's free plan one request may make at most 50 subrequests, counting every fetch, D1 statement or batch and R2 operation. Measured by `steamWorkerBudget.test.ts` over D1 and R2: a request costs about 7 to 9 subrequests before writing anything, raising a stored time costs 3 more per game, adding a game the catalog already has costs 3, and adding a game from IGDB (its metadata, two Steam images archived, a SteamGridDB lookup and the rows and files that store them) costs about 18. The server therefore stops a request when the next game would not fit and answers those games as `deferred`; the browser sends them again first. In practice a request takes 2 new IGDB games, or all 10 time updates or catalog additions. On the home server the same code runs with the same batches.
