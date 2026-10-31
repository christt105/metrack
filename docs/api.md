# HTTP API

The private editing API served by `apps/server` under `/api`. There is no authentication: the service is meant for a trusted local network (see the security model in the README). Requests and responses are JSON unless noted. Every type named here is exported from `@metrack/domain` (`packages/domain/src/api` and the entity types next to it), so the web app imports the contract instead of redefining it.

## Conventions

- Dates are ISO `YYYY-MM-DD` and must be real calendar dates. Ratings are numbers from 0 to 10.
- Bodies are validated against a schema. Unknown fields are rejected, not ignored.
- Errors always have the shape `ApiErrorBody`: `{ "error": "message for people", "code": "stable_code", "details": optional }`. Status codes: 400 validation or bad input, 404 unknown record, 409 conflict with the current state, 501 a provider or source that is not configured, 502 a provider failed.
- Common codes: `validation_error`, `not_found`, `conflict` (a unique id is taken), `invalid_reference`, `invalid_date`, `invalid_dates`, `invalid_transition`, `invalid_rewatch`, `already_added`, `provider_not_configured`, `no_metadata_source`, `provider_error`, `provider_not_found`, `sync_not_configured`, `unsupported_image_kind`, `url_not_allowed`, `image_download_failed`, `ids_required`, `invalid_ids`, `cannot_resolve`.
- Any successful write under `/api` marks the public site as changed, so the publisher rebuilds it after a short debounce. Reads never do.
- Images are never linked to a provider. `cover` and `banner` always hold `/api/images/<hash>`, a copy in the server image store.

## Collections

`COLLECTIONS` lists the URL segments: `movies`, `series`, `seasons`, `games` and `books`. They map to the entity types `Movie`, `Series`, `Season`, `Videogame` and `Book` (`MEDIA_TYPE_OF_COLLECTION` gives the `MediaType`). Series have no tracking of their own: status, dates, rating and rewatches belong to their seasons, and the series only has a free-text `review`.

### Listing: `GET /api/media`

One list across every collection, as `MediaPage` (`{ items: MediaSummary[], total }`). Query parameters (`MediaQuery`):

- `type`: `movie`, `series`, `season`, `videogame` or `book`.
- `status`: one of `MEDIA_STATUSES`. A series matches when any of its seasons has that status.
- `q`: text search over the title and original title (and the series title for seasons), ignoring case and accents.
- `sort`: `title` (default), `recent`, `rating`, `startedAt`, `finishedAt`, `releaseDate` or `id`. `order`: `asc` (default) or `desc`. Rows missing the sort value always come last. `recent` puts titles in progress first and then orders by the latest day each was started, finished or rewatched, newest first unless `order=asc`; a series takes both from its seasons. The web library uses `recent` by default.
- `limit` (1 to 1000, default 50) and `offset`.

A `MediaSummary` has `type`, `id`, `title`, `subtitle`, `releaseDate`, `cover`, `status`, `rating`, `startedAt`, `finishedAt`, plus `seriesId` and `seriesTitle` for seasons and `seasonCount` for series, and `pendingReview` (a series is pending when any of its seasons is). A season without its own cover shows the cover of its series.

### Per collection

- `GET /api/{collection}/{id}`: the entity as `MediaDetail<T>`, which adds `editedFields` (fields a refresh will not overwrite) and `fetchedAt`. A series answers `SeriesDetail`: it also carries `seasons` (ordered by number) and `overrides`.
- `POST /api/{collection}`: creates an entity and answers 201 with its detail. The body is `CreateInput`: any entity field except `id`, `cover` and `banner`. `title` is required, except for seasons, which require `seriesId` (an existing series, else `invalid_reference`) and `number`. Status defaults to `planned`.
- `PATCH /api/{collection}/{id}`: edits any subset of the fields (`EditablePatch`) and answers the new detail. At least one field is required. See the rules below.
- `DELETE /api/{collection}/{id}`: 204. Deleting a series deletes its seasons. Image files stay in the store until `POST /api/images/cleanup`.
- `DELETE /api/{collection}/{id}/edited/{field}`: stops protecting a hand-edited field, so the next refresh may overwrite it. 404 if the field is not marked.

Editable fields per collection:

- `movies`: `tmdbId`, `jellyfinId`, `title`, `originalTitle`, `releaseDate`, `overview`, `genres`, `cast`, `director`, `follow`, `note`, `slug`, `tags` and the tracking fields.
- `series`: `tmdbId`, `tvdbId`, `jellyfinId`, `title`, `originalTitle`, `firstAirDate`, `overview`, `genres`, `cast`, `follow`, `note`, `review`, `slug`, `tags`.
- `seasons`: `number`, `tmdbSeasonNumber`, `jellyfinId`, `title`, `overview`, `firstAirDate`, `episodeCount`, `slug`, `tags` and the tracking fields.
- `games`: `igdbId`, `steamAppId`, `steamGridDbId`, `title`, `releaseDate`, `overview`, `genres`, `developer`, `platforms`, `note`, `slug`, `tags` and the tracking fields.
- `books`: `openLibraryId`, `isbn`, `title`, `authors`, `publisher`, `pageCount`, `releaseDate`, `overview`, `genres`, `note`, `slug`, `tags` and the tracking fields.

The tracking fields are `status`, `startedAt`, `finishedAt`, `rating`, `review`, `rewatches` and `pendingReview`. `pendingReview` is set by the Jellyfin sync on every viewing it records and cleared by patching it to `false`; while it is set, the exported page carries `pending_review: true` and the site feeds leave it out.

### Editing rules

- `status` follows the domain transition rules (`canTransition`). A forbidden move answers 409 `invalid_transition` and changes nothing. Entering `in_progress` sets `startedAt` when empty and keeps `finishedAt`; entering `completed` sets `startedAt` when empty and `finishedAt` to today, unless the item was already finished, in which case `finishedAt` keeps the first finish and today is added to `rewatches` (when it is a later day). Dates sent in the same request win over those automatic dates, and a request that sends `finishedAt` without `startedAt` leaves an empty start date empty instead of filling it with today. Sending the current status changes nothing.
- `finishedAt` before `startedAt` answers 400 `invalid_dates`.
- `rewatches` sent in a patch replaces the whole list (sorted, without duplicates). Prefer the two routes below to add or remove one.
- Metadata fields are marked as hand-edited when a patch actually changes them: `title`, `originalTitle`, `releaseDate`, `firstAirDate`, `overview`, `genres`, `cast`, `director` (movies and series), `developer`, `platforms` (games), `authors`, `publisher`, `pageCount` (books), `episodeCount` (seasons). Sending a form with unchanged values does not mark anything. Ids, tracking, `note`, `tags`, `slug` and `follow` are never marked. Choosing or removing an image marks `cover` or `banner`.

### Rewatches (not for series)

- `POST /api/{collection}/{id}/rewatches` with `{ "date": "YYYY-MM-DD" }` (`RewatchRequest`): adds a viewing. Only completed items can be rewatched, otherwise 409 `invalid_rewatch`. Answers 201 with the detail.
- `DELETE /api/{collection}/{id}/rewatches/{date}`: removes it, 404 if there is no rewatch on that date.

### Season overrides

Manual corrections keyed by a series and a TMDB season number (`SeasonOverride`). The body of `PUT` is `SeasonOverrideInput`: `number`, `title` and `jellyfinSeasonId`, each optional and null by default.

- `GET /api/series/{id}/overrides`
- `PUT /api/series/{id}/overrides/{tmdbSeasonNumber}`: creates or replaces. Answers the override.
- `DELETE /api/series/{id}/overrides/{tmdbSeasonNumber}`: 204 or 404.

## Metadata refresh

`POST /api/metadata/{type}/{id}/refresh` (`type` is a `MediaType`) asks the provider again, ignoring expiry, and answers a `RefreshResult`: `fresh`, `unchanged`, `updated` with the changed `fields`, or `failed` with the provider `error` (stored data is kept). Hand-edited fields are never overwritten. Types without a configured source (today everything except `movie` and `series`, or all of them without `TMDB_API_KEY`) answer 501 `no_metadata_source`.

## Search and adding titles

- `GET /api/search?type=&q=&year=`: `type` is one of `SEARCHABLE_TYPES` (`movie`, `series`, `videogame`, `book`), `q` is required and `year` is optional. Answers `{ "results": SearchResult[] }`. `externalId` is what to send to add the title, `existingId` is the id of the entity that already holds it (or null) so the UI can link instead of adding twice.
- `POST /api/titles` with `{ "type", "externalId" }` (`AddTitleRequest`): creates the entity from the provider, fills its metadata and downloads its images. A series also gets one planned season per TMDB season, skipping specials. Answers 201 with `EntityRef` (`{ type, id }`). A title that is already there answers 409 `already_added` with `details.existingId`.

Movies and series come from TMDB (needs `TMDB_API_KEY`) and games from IGDB (needs `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`). A game is added once with its IGDB metadata (games have no metadata refresh) and its artwork: the official Steam library cover and hero when IGDB links the game to Steam, otherwise the IGDB cover and first screenshot. With `STEAMGRIDDB_TOKEN` set, a game on Steam is also linked to its SteamGridDB id, so the artwork picker offers community art for it. A type whose provider is not configured, and `book` until the Open Library client exists, answers 501 `provider_not_configured`. Games and books can still be created by hand with `POST /api/games` and `POST /api/books`.

## Unlinked inbox

Titles that arrived without an external id wait here (`UnlinkedTitle`).

- `GET /api/unlinked`: the list.
- `DELETE /api/unlinked/{id}`: dismisses one (204 or 404).
- `POST /api/unlinked/{id}/resolve` with `{ "ids": ExternalIds }` (`ResolveUnlinkedRequest`): creates the real entity and removes the title from the inbox. Answers 201 with `ResolveUnlinkedResponse` (`{ type, id, refresh }`). The ids that apply are: movies `tmdbId` and `jellyfinId`; series `tmdbId`, `tvdbId` and `jellyfinId`; games `igdbId`, `steamAppId` and `steamGridDbId`; books `openLibraryId` and `isbn`. At least one is needed (`ids_required`) and others are refused (`invalid_ids`). With a `tmdbId` for a movie or series and TMDB configured, the entity is added through the provider, exactly like `POST /api/titles`. Otherwise it is created from the inbox title and the given ids, and refreshed when a source exists. A season cannot be resolved by id (`cannot_resolve`): link its series instead. If creation fails (for example the id is already used, 409) the title stays in the inbox.

## Images

Kinds are `cover` and `banner` (`IMAGE_KINDS`); books only have `cover`.

- `GET /api/{collection}/{id}/images/{kind}`: candidates as `ImageCandidateList`: `{ candidates: ImageCandidate[], failures: [{ provider, error }] }`. A provider that fails is reported in `failures` and does not hide the others. TMDB covers movies, series and seasons (season posters only, no banners); SteamGridDB covers games that have `steamGridDbId` and needs `STEAMGRIDDB_TOKEN`. An entity without the needed id simply has no candidates.
- `PUT /api/{collection}/{id}/images/{kind}` with `{ "url" }` (`ImageChoice`): the URL must be one of the candidate `url` values, or at least come from a provider host (`image.tmdb.org`, `steamgriddb.com`), otherwise 400 `url_not_allowed`. The server downloads it into the image store, points the entity at the copy and marks the field as hand-edited. Answers the detail.
- `DELETE /api/{collection}/{id}/images/{kind}`: clears the field, marks it as hand-edited and deletes the stored file when no other entity uses it. Answers the detail.
- `thumbUrl` of a candidate is only for previews in the picker and is never stored.
- `GET /api/images/{hash}` serves a stored image with long-lived caching, `DELETE /api/images/{hash}` deletes it and clears every reference, and `POST /api/images/cleanup` deletes the images nothing references and answers `{ "removed": [hash] }`.

## Publishing and health

- `POST /api/publish`: queues a publish and answers 202 `{ "status": "queued", "failures": n }`.
- `GET /api/health`: `HealthReport`. Answers 200 when `status` is `ok` and 503 with the same body when it is `degraded`, so the container health check fails.

## Backups

- `GET /api/backups`: the stored backups, newest first, as `{ name, createdAt, sizeBytes, hasImages }[]`.
- `POST /api/backups`: takes a backup now, prunes to the retention count and answers 201 with the new backup. A failure answers 500 `backup_failed` with a generic message; the details are only in the server log.

## Jellyfin sync

- `GET /api/sync/report`: the `SyncPlan` a sync would apply: `movies` (`MovieChange`), `series` (`SeriesChange` with its `seasons`), `unlinked`, `warnings`, `ignoredPlays` and `unmatchedTitles`. Reads Jellyfin and Jellystat and the database; writes nothing.
- `POST /api/sync/apply` with `{ "confirm": true }`: recomputes the plan on the server (a client-supplied plan is never trusted), writes it in one transaction and answers `{ plan, result: SyncApplyResult }`. A body without `confirm: true` is a 400.
- Both answer 501 `sync_not_configured` unless the Jellyfin and Jellystat variables are set (see the README).

## Release alerts

- `GET /api/watchlist`: the followed movies and series as `WatchlistEntry[]`, ordered by title. A series shows the first air date of its newest season.
- `PUT /api/watchlist/{movies|series}/{id}` and `DELETE /api/watchlist/{movies|series}/{id}`: follow and unfollow (the `follow` field, so a `PATCH` does the same). 204, or 404 for an unknown id.
- `GET /api/alerts?limit=100`: the alerts already sent as `ReleaseAlert[]`, newest first (`limit` from 1 to 500).

## Not in the API

Importing the Obsidian notes stays a command of the server CLI (`metrack import`), and the export is run by the publisher or by `metrack export`. Both read and write the same database and image store as the server.
