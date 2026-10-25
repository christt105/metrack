# metrack

Self-hosted media tracker: movies, series (tracked per season), games and books, stored in SQLite and served by a single container. This is the service skeleton: a health route, versioned migrations and a Vue shell.

## Layout

- `packages/domain`: pure domain logic, no HTTP or database.
- `packages/export`: pure exporter from stored data to the Hugo content tree, and the redirect pages for the old site.
- `apps/server`: Fastify API, SQLite storage and migrations; also serves the built web app.
- `apps/web`: Vue 3 + Vite frontend.

## Development

Requires Node 22 and npm 10.

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

The HTTP API used by the private editing interface is documented in [docs/api.md](docs/api.md); its types live in `@metrack/domain`.

Run the API with `npm run dev:server` (port 8097, data in `./data`) and the web app with `npm run dev:web`, which proxies `/api` to the API.

## Docker

```sh
docker compose up -d --build
curl http://localhost:8097/api/health
```

The port is set with `METRACK_PORT` (default 8097) and the data directory with `METRACK_DATA` (default `./data`, mounted at `/data`). The database lives at `/data/metrack.db`.

Images are stored under `/data/images`, named by content hash, and are served at `/api/images/<hash>`. Provider access is configured with `TMDB_API_KEY` (a v3 key or v4 token, required for metadata refresh), `TMDB_LANGUAGE` (default `es-ES`) and `STEAMGRIDDB_TOKEN`. No keys are bundled.

## Importing the Obsidian vault

```sh
npm run metrack -w @metrack/server -- import "/path/to/vault/Media Tracker"
npm run metrack -w @metrack/server -- import "/path/to/vault/Media Tracker" --apply
npm run metrack -w @metrack/server -- import "/path/to/vault/Media Tracker" --images-dir /path/to/MediaTracker/static --images-dir "/path/to/vault/Media Tracker/Portadas"
```

Without `--apply` the command only prints a report (counts per type, notes with problems, titles that would go to the unlinked inbox) and writes nothing, not even the database. With `--apply` it writes to the database and image store in `DATA_DIR` (or `--data-dir`). `--verbose` lists every affected note instead of the first few.

The notes are never modified. The import can be repeated: rows are matched by `tmdb_id`, `igdb_id`, `openlibrary_id` or `isbn` (seasons by series and number, unlinked titles by note path), and only changed fields are written. Tracking fields (status, `date` as `finished_at`, rating, review, rewatches) follow the note on every run; descriptive fields and images are only filled in or changed, never emptied.

Local covers and banners (such as `Portadas/`) go through the image store. A remote cover or banner URL is linked only if a copy of that exact URL is already stored; nothing is downloaded. `--images-dir` (repeatable) points at folders written by the previous Hugo site, whose migration script cached each remote image as `tmdb_<id>.<ext>`, `tvdb_<id>.<ext>`, `steamgriddb_<id>.<ext>`, `steam_<appid>_<name>.<ext>` or, for any other URL, `img_<md5 of the URL>.<ext>`. The importer derives that name from every remote cover and banner URL, searches the folders recursively, stores the matching file through the image store and records the URL, so later runs link it directly. The report lists the URLs that have no matching file. A series note without season notes becomes a series with one season holding its tracking. Notes without an external id, with an id already used by another note, or whose series cannot be found go to the unlinked inbox.

## Exporting to Hugo

```sh
npm run metrack -w @metrack/server -- export /path/to/site
```

`export` reads the database and image store in `DATA_DIR` (or `--data-dir`) and writes `content/movies`, `content/tv`, `content/seasons`, `content/games` and `content/books` under the output directory, replacing those sections and leaving everything else alone. The tree is what the current `hugo-mediatracker-theme` expects: one page bundle per item named like the old note (the vault file name is kept as `slug`, so page addresses stay the same), the cover and banner next to `index.md`, and the review as the page body with wikilinks to known pages turned into `ref` links and YouTube links into shortcodes. The output is deterministic: the same data always produces the same files. Images that came from a remote URL keep the file name the old migration script gave them, other images are named by hash.

A series with season notes exports a `tv` page that only groups its seasons (status `not_started`, plus its review) and one `seasons` page per season; a series whose only season has no note exports a single `tv` page carrying that season's tracking. Items without a stored name get one derived from their title and year. Books are exported to `content/books`, which the theme does not list yet.

`export` does not write the Hugo project itself (`hugo.toml`, layouts, data files, static pages such as `about.md`): those live in a site template directory that is never modified.

## Publishing

The service builds the site and uploads it to Cloudflare Pages by direct upload (`wrangler pages deploy`), so images never go through git. Wrangler is not a dependency of the image: it runs through `npx` at the exact version in `WRANGLER_VERSION` (`apps/server/src/publish/CloudflarePagesPublisher.ts`), downloaded on first use, and upgrading it means changing that constant. It receives the Cloudflare credentials plus only an allowlist of the server's environment (`WRANGLER_INHERITED_ENV`: `PATH`, `HOME`, npm cache, proxy and CA variables). Publishing is event driven: any successful write under `/api` marks the site as changed, `POST /api/publish` does the same on request, and a short debounce turns a burst of edits into one attempt. An attempt exports the data and compares its fingerprint with the last published one, so nothing is built or uploaded when the site would be identical. Otherwise it copies the site template, adds the export, runs `hugo` and uploads the result. A failed attempt is retried with exponential backoff (1 minute, doubling, up to 1 hour) and every failure goes through the `Notifier`; today that only logs, and it will use the ntfy notifier of the backups module once that is merged.

Publishing stays off, with a log line naming what is missing, unless all of these are set. Credentials are only ever read from the environment.

- `PUBLISH_SITE_TEMPLATE_DIR`: Hugo project without the exported content sections.
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`: the Pages project to deploy to.
- `HUGO_BIN` (default `hugo`) and `CLOUDFLARE_PAGES_BRANCH` (default `main`).

The container image does not include `hugo`, `go` (the theme is a Hugo module) or network access to fetch wrangler; provide them to enable publishing. The upload to Cloudflare is not covered by automated tests: the publisher is tested with a fake command runner and the pipeline with a fake publisher. Changes to the site template alone do not trigger a publish, because the fingerprint covers only the exported content.

## Redirecting the old site

```sh
npm run metrack -w @metrack/server -- redirect /path/to/old-site-repo --origin https://new-address.example
```

Writes `404.html` and `index.html` for the old GitHub Pages site. GitHub Pages serves `404.html` for any missing path, so a single file covers every old address: it has a `<meta http-equiv="refresh">` to the new root, a `rel="canonical"` link, and a script that replaces the location with the same path, query and hash on the new origin (the old base path `/MediaTracker`, configurable with `--old-base`, is removed first) and rewrites the canonical link to that exact address. The command only writes those two files into the given directory.

## Checking parity with the old site

`tools/parity/compareContent.ts` compares the `content` tree of the old repository with an export and reports, per type, pages that are missing or extra, front matter fields that differ (null, empty values, numbers and dates are normalized first), bodies that differ (embedded images are compared by bytes) and images whose bytes or names differ.

```sh
npm run metrack -w @metrack/server -- import "/path/to/vault/Media Tracker" --apply --data-dir /tmp/parity/data --images-dir /path/to/MediaTracker/static/images_cache
npm run metrack -w @metrack/server -- export /tmp/parity/out --data-dir /tmp/parity/data
npx tsx tools/parity/compareContent.ts /path/to/MediaTracker/content /tmp/parity/out/content
```

## Dependencies

- `node:sqlite` (built into Node 22): avoids a native module and a build toolchain in the image; it is still marked experimental, so it is confined to `apps/server/src/storage` and the image silences its warning.
- `fastify` and `@fastify/static`: routing, in-process request injection for tests and static file serving with little code.
- `pg`: the only way to read Jellystat, which exposes its history through its own login-protected API and its Postgres database; used for one read-only query.
- `vue`, `vite`, `@vitejs/plugin-vue`, `vue-tsc`: the frontend.
- `yaml`: parses note frontmatter (quoted strings, block lists, multi-line values) and quotes values when writing front matter for Hugo, both of which a hand-written implementation would get subtly wrong; zero dependencies of its own.
- `vitest`, `eslint`, `prettier`, `typescript`, `tsx`: tests, lint, formatting, type checking and dev reload.

## Migrations

Migrations are TypeScript modules in `apps/server/src/storage/migrations`, numbered contiguously from 1 and registered in `index.ts`. They run in order at startup, each in its own transaction, and are recorded in `schema_migrations`.

## Backups

The server writes a backup every `BACKUP_INTERVAL_HOURS` (default 24) to `/data/backups`, keeping the newest `BACKUP_RETENTION` (default 14). A check runs at startup and every 10 minutes, and a backup is taken when the newest one is older than the interval, so a restart after downtime catches up. After a failure the next attempt waits 10 minutes, doubling on each consecutive failure up to the interval. A run of failures sends one alert, and one more message when a backup succeeds again. Set `BACKUP_ENABLED=false` to turn the scheduler off.

Each backup is a directory `metrack-<UTC timestamp>` containing `metrack.db`, a consistent copy made with `VACUUM INTO` that is checked with `PRAGMA integrity_check` before it is accepted, and `images/` when `/data/images` exists. A failed backup leaves nothing behind.

| Variable                               | Default             | Meaning                                                                                                 |
| -------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `BACKUP_ENABLED`                       | `true`              | Run the internal scheduler                                                                              |
| `BACKUP_DIR`                           | `$DATA_DIR/backups` | Where backups are written                                                                               |
| `BACKUP_RETENTION`                     | `14`                | Number of backups to keep                                                                               |
| `BACKUP_INTERVAL_HOURS`                | `24`                | Minimum age of the newest backup before a new one is taken                                              |
| `NTFY_URL`, `NTFY_TOPIC`, `NTFY_TOKEN` | unset               | Send a failure alert to ntfy; `NTFY_TOKEN` is optional. Without URL and topic, failures are only logged |

Manual use:

```sh
curl -X POST http://localhost:8097/api/backups
curl http://localhost:8097/api/backups
docker exec metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js backups
docker exec metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js backup
```

### Restore

Stop the service first, since the database file is replaced. Then run the restore in a one-off container (the name comes from `backups`) and start the service again. The backup is re-verified and copied next to the live data before anything is overwritten. The database and image store being replaced are then moved to `/data/pre-restore-<UTC timestamp>` (the command prints the path), and the backup takes their place. To undo a restore, stop the service and move `metrack.db` and `images/` back from that directory. Safety directories are never deleted automatically; remove them once the restored data looks right.

```sh
docker compose stop metrack
docker compose run --rm metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js restore metrack-20261024T031500000Z
docker compose start metrack
```

A test restores a backup over a modified database and image store and checks the result matches the original and the replaced data is kept in the safety directory.

### Off-server copy

The service does not copy backups off the machine. Run something on the host against the bind-mounted `${METRACK_DATA}/backups` directory, for example a daily cron job:

```sh
rsync -a --delete /path/to/metrack-data/backups/ backup-host:/srv/backups/metrack/
rclone sync /path/to/metrack-data/backups remote:metrack-backups
```

Backups are immutable directories, so syncing the whole folder is safe. Restore from an off-server copy by placing the backup directory back under `backups/` and running the restore above.

## Jellyfin viewing sync

The service can compare what was played in Jellyfin with the tracking. The structure (seasons, episodes, provider ids) comes from the Jellyfin API and the dates from Jellystat's `jf_playback_activity` table, read directly from its Postgres database in a read-only session. Jellyfin 12 only accepts the `Authorization: MediaBrowser Token="..."` header, which is what the client sends. Jellystat only records real playback, so items marked as watched by hand never show up. Syncing is off unless the four required variables are set.

| Variable                                     | Default                   | Meaning                                             |
| -------------------------------------------- | ------------------------- | --------------------------------------------------- |
| `JELLYFIN_URL`, `JELLYFIN_TOKEN`             | required                  | Jellyfin address and an API key                     |
| `JELLYSTAT_DB_HOST`, `JELLYSTAT_DB_PASSWORD` | required                  | Jellystat Postgres host and password                |
| `JELLYSTAT_DB_PORT`, `_USER`, `_NAME`        | 5432, postgres, jellystat | Rest of the connection                              |
| `JELLYFIN_USER`                              | `admin`                   | Jellyfin account whose viewings are tracked         |
| `SYNC_TIME_ZONE`                             | `Europe/Madrid`           | Time zone that decides on which day a viewing falls |

Rules: an item counts as watched when 90% of its runtime was played in one day. A watched movie without a finish date completes with that day, and later viewings become rewatches (a viewing the day after the recorded date is taken as the same one). The first watched episode puts the season in progress with `started_at`; once every episode is watched and none is still to air the season completes with `finished_at` set to the day the last one was first watched. Ratings, reviews and notes are never touched. Library seasons are paired with stored seasons by Jellyfin id, a season override, the date of the first episode (never the number, so TMDB season 3 pairs with Jellyfin season 4 for Lupin) and finally the number for stored seasons that have no air date. Titles without any id go to the unlinked inbox. Playback of items that left the library or came back under new ids cannot be matched and is only counted.

The first pass is report only:

```sh
node --disable-warning=ExperimentalWarning apps/server/dist/cli.js sync --verbose
curl http://localhost:8097/api/sync/report
```

`sync` without `--apply` opens the database read-only. `sync --apply` and `POST /api/sync/apply` with `{ "confirm": true }` recompute the plan and write it in one transaction. The settings page has the same two steps.

## Release alerts

Following a series (`follow`) or a movie puts it on the watchlist (the "Following" page, or the button on its page). A worker asks TMDB about every followed title and sends an ntfy notification, with the poster attached, once per (movie or season, kind):

- `releases_tomorrow` the day before the release and `releases_today` on the day. These only fire on their exact day, so a late warning is never sent.
- `available_es` when TMDB lists a `flatrate` provider for Spain (`buy` and `rent` are ignored) for a release that happened in the last 14 days (seasons) or 60 days (movies).

The release date of a season is its `air_date`, or the date of `next_episode_to_air` when that is the first episode and the season has no date yet. For a movie it is the earliest Spanish premiere or limited release in `release_dates`, falling back to `release_date`. When TMDB announces a season of a followed series that is not stored, the season is created as `planned`. It is paired with an existing season by its stored TMDB number, then by the date of its first episode, and a season override can give it another number. Seasons that are missing locally but were released long ago are left alone. When the season shows up in Jellyfin under another number, the Jellyfin sync pairs it by date, so nothing is duplicated.

How often a title is asked about depends on how close its release is: every 30 minutes from the day before to the day after, every 3 hours while providers may still be catching up, and twice a day otherwise. The scheduler ticks every 10 minutes and keeps the due times in memory. Nothing is checked or sent before `ALERTS_NOTIFY_FROM_HOUR`, so alerts do not arrive at night. An alert is recorded in `release_alert` only once ntfy has accepted it, and recorded alerts are listed on the Following page; an alert ntfy does not accept stays pending and is retried 30 minutes later. Alerts need `TMDB_API_KEY`; without `NTFY_URL` and `NTFY_TOPIC` they are only logged.

| Variable                  | Default         | Meaning                                                      |
| ------------------------- | --------------- | ------------------------------------------------------------ |
| `ALERTS_ENABLED`          | `true`          | Run the worker                                               |
| `ALERTS_TIMEZONE`         | `Europe/Madrid` | Time zone that decides what "today" and "tomorrow" mean      |
| `ALERTS_NOTIFY_FROM_HOUR` | `8`             | Local hour (0 to 23) before which nothing is checked or sent |

Limitations:

- TMDB watch providers are JustWatch data, have no date and can lag by hours or days, so `available_es` can arrive later than the real availability.
- There is no free source for "episode X airs in Spain" for weekly broadcast series. Only season premieres are announced, never single episodes, and a season that streams all at once is detected by its provider listing.
- A season that TMDB lists without any date is not created or announced until it gets one. If a release date moves after an alert was sent, the alert is not repeated.
- Created seasons have no cover of their own and show the series cover until a metadata refresh or an image choice sets one.
