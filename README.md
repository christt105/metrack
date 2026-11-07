# metrack

[![CI](https://github.com/christt105/metrack/actions/workflows/ci.yml/badge.svg)](https://github.com/christt105/metrack/actions/workflows/ci.yml)

Self-hosted media tracker for movies, series (tracked per season), games and books. One container holds the data in SQLite, serves a web app to edit it and publishes a static Hugo site with the collection.

## Features

- Web app to add and edit titles. Movies and series are searched and refreshed from TMDB, games are searched on IGDB and books on Open Library; anything can also be entered by hand. Artwork comes from TMDB, Steam, IGDB, SteamGridDB and Open Library and is stored locally by content hash.
- Per-season tracking for series: status, dates, rating, review and rewatches.
- Importer for the Obsidian `Media Tracker` vault and exporter to the Hugo content tree of [hugo-mediatracker-theme](https://github.com/christt105/hugo-mediatracker-theme).
- Event-driven publishing to Cloudflare Pages: an edit rebuilds and uploads the site only when the exported content changed.
- Jellyfin viewing sync through Jellystat, with a report-only pass before anything is written.
- Release alerts over ntfy for followed series and movies (premieres and Spanish streaming availability).
- Scheduled, verified backups with retention and a restore command.

## Security model

Every API route needs a signed-in session except health, logout and the Jellyfin webhook (which only schedules a sync, and needs `SYNC_WEBHOOK_SECRET` when it is set). Users are listed with `metrack users` and created with `metrack users add <name> [--email <address>]` (in Docker: `docker exec metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js users add <name>`); user 1 owns everything stored before users existed. Sign-in with Google is planned; for now the only way to sign in is dev login (`DEV_LOGIN=true`), where the sign-in page lists every user and anyone who can open it picks one with no password. With dev login off, nobody can sign in.

Dev login is only safe on a trusted local network, so until there is a real sign-in method do not expose metrack to the internet. Only the published static site is meant to be public. Each user only sees and edits their own library: every personal row (tracking, reviews, notes, hand edits, followed titles, season overrides, the unlinked inbox and sent alerts) has an owner, and every query filters by the signed-in user. What providers describe about a title (TMDB, IGDB, Open Library) is a shared catalog, so two users who add the same film share one catalog row and keep separate entries; changing an external id of a title someone else also has is refused. Backups and deleting images (images are shared by hash) act on the whole instance and belong to the owner, user 1. The owner can make other users trusted (in Settings or with `metrack users set <id> --role trusted`): only the owner and trusted users add items by hand, the ones no provider knows, which stay private to whoever created them; everyone else adds titles from the providers. Personal API tokens, created in Settings, let a program read or change one user's library with `Authorization: Bearer`; they never reach settings, tokens or owner-only actions (see `docs/api.md`).

### Per-user settings

The background jobs run once for each user whose settings enable them, each as that user, so a job only reads and writes its user's library: the Jellyfin sync reads that user's Jellyfin account, release alerts watch what that user follows and go to their ntfy topic, publishing builds their site from their data into their Cloudflare Pages project, and the vault mirror writes their notes into their folder. The instance keeps the connections and credentials (Jellyfin and Jellystat, the ntfy server and token, the Cloudflare account, the site template); a user's settings only say what to act on:

| Setting            | Enables                               | Starts from (user 1)       |
| ------------------ | ------------------------------------- | -------------------------- |
| `jellyfinUser`     | Jellyfin sync of that account         | `JELLYFIN_USER`, `admin`   |
| `ntfyTopic`        | Release alerts and job failure alerts | `NTFY_TOPIC`               |
| `publishProject`   | Publishing to that Pages project      | `CLOUDFLARE_PAGES_PROJECT` |
| `publishBaseUrl`   | The site address passed to Hugo       | `PUBLISH_BASE_URL`         |
| `mirrorDir`        | The vault mirror into that folder     | `VAULT_MIRROR_DIR`         |
| `mirrorLinkPrefix` | That folder's path inside the vault   | `VAULT_MIRROR_LINK_PREFIX` |

The first time the server starts with this table, user 1's settings are stored from those variables (`admin` only when sync is configured), so an existing install keeps doing exactly what it did. From then on the stored settings win; a variable that disagrees is logged at start and ignored. Every user sees their own settings under Settings in the web app, but only the owner changes them, because they point the instance's credentials at an account, a project or a folder. The owner edits everyone's from the Users panel there (or `PATCH /api/users/{id}/settings`), except the vault folder, which the server writes into and so is only set from the command line. Values are checked (ntfy topic characters, a Cloudflare Pages project name, an http or https site address, an absolute folder, a vault path without `..`). From the command line: `metrack users set <id> [--jellyfin-user <name>] [--ntfy-topic <topic>] [--publish-project <name>] [--publish-base-url <url>] [--mirror-dir <dir>] [--mirror-link-prefix <path>]`, where an empty value clears one; `metrack users set <id>` alone shows them and `metrack users` lists which jobs run for each user. Changes apply to the next run without a restart, except that a newly set vault folder is first mirrored after the next write or restart. Job state lives in the data directory: user 1 keeps `publish-state.json`, `publish/` and `vault-mirror-state.json` at its root, other users have them under `users/<id>/`. Because titles are a shared catalog, any write marks every user's site and mirror as changed; a run whose export did not change does nothing.

## Quick start

```sh
curl -O https://raw.githubusercontent.com/christt105/metrack/main/docker-compose.yml
DEV_LOGIN=true docker compose up -d
curl http://localhost:8097/api/health
```

Then open `http://<host>:8097` and sign in as the owner (see the security model above). Every integration is optional and stays off, with a log line naming the missing variables, until it is configured; see the sections below.

## Layout

- `packages/domain`: pure domain logic, no HTTP or database.
- `packages/export`: pure exporter from stored data to the Hugo content tree, and the redirect pages for the old site.
- `apps/server`: Fastify API, SQLite storage and migrations; also serves the built web app.
- `apps/web`: Vue 3 + Vite frontend.

## Development

Requires Node 22.13 or later and npm 10.

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

Images are published to GitHub Container Registry as `ghcr.io/christt105/metrack` and can be pulled without logging in.

```sh
docker compose pull && docker compose up -d
curl http://localhost:8097/api/health
```

The image tag is set with `METRACK_TAG` (default `latest`), the port with `METRACK_PORT` (default 8097) and the data directory with `METRACK_DATA` (default `./data`, mounted at `/data`). The database lives at `/data/metrack.db`. To run a local build instead, tag it and point `METRACK_TAG` at it:

```sh
docker build -t ghcr.io/christt105/metrack:dev . && METRACK_TAG=dev docker compose up -d
```

### Images and releases

CI runs lint, typecheck, tests and build on every pull request and push to `main`, then builds the image. Every pull request from this repository publishes a preview image, `ghcr.io/christt105/metrack:pr-<number>`, so it can be tried on the server before merging. Pushing a `vX.Y.Z` tag that points at a commit on `main` publishes `vX.Y.Z`, `vX.Y` and `latest`; tags outside `main` fail the release. The image tag is passed as `APP_VERSION` and reported by `/api/health`.

```sh
git tag -a v0.2.0 -m "v0.2.0" && git push origin v0.2.0
```

Images are stored under `/data/images`, named by content hash, and are served at `/api/images/<hash>`. Provider access is configured with `TMDB_API_KEY` (a v3 key or v4 token, required for metadata refresh), `TMDB_LANGUAGE` (default `es-ES`), `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` (a Twitch application, for game search) and `STEAMGRIDDB_TOKEN`. No keys are bundled. Book search uses Open Library, which needs no key; `OPENLIBRARY_LANGUAGE` (an ISO 639-1 code, by default the language part of `TMDB_LANGUAGE`) picks the edition whose title, cover, publisher and ISBN are used.

## Importing the Obsidian vault

```sh
npm run metrack -w @metrack/server -- import "/path/to/vault/Media Tracker"
npm run metrack -w @metrack/server -- import "/path/to/vault/Media Tracker" --apply
npm run metrack -w @metrack/server -- import "/path/to/vault/Media Tracker" --images-dir /path/to/MediaTracker/static --images-dir "/path/to/vault/Media Tracker/Portadas"
```

Without `--apply` the command only prints a report (counts per type, notes with problems, titles that would go to the unlinked inbox) and writes nothing, not even the database. With `--apply` it writes to the database and image store in `DATA_DIR` (or `--data-dir`). `--verbose` lists every affected note instead of the first few.

The notes are never modified. The import can be repeated: rows are matched by `tmdb_id`, `igdb_id`, `openlibrary_id` or `isbn` (seasons by series and number, unlinked titles by note path), and only changed fields are written. Tracking fields (status, `date` as `finished_at`, rating, review, rewatches) follow the note on every run; descriptive fields and images are only filled in or changed, never emptied.

Local covers and banners (such as `Portadas/`) go through the image store. A remote cover or banner URL is linked only if a copy of that exact URL is already stored; nothing is downloaded. `--images-dir` (repeatable) points at folders written by the previous Hugo site, whose migration script cached each remote image as `tmdb_<id>.<ext>`, `tvdb_<id>.<ext>`, `steamgriddb_<id>.<ext>`, `steam_<appid>_<name>.<ext>` or, for any other URL, `img_<md5 of the URL>.<ext>`. The importer derives that name from every remote cover and banner URL, searches the folders recursively, stores the matching file through the image store and records the URL, so later runs link it directly. The report lists the URLs that have no matching file. A series note without season notes becomes a series with one season holding its tracking. Notes without an external id, with an id already used by another note, or whose series cannot be found go to the unlinked inbox.

## Mirroring to the Obsidian vault

```sh
npm run metrack -w @metrack/server -- mirror "/path/to/vault/Media Tracker" --web-url http://192.168.1.15:8100
npm run metrack -w @metrack/server -- mirror "/path/to/vault/Media Tracker" --web-url http://192.168.1.15:8100 --apply
```

Once the web app is the only place where tracking is edited, `mirror` keeps a read-only copy of the library in the vault so other notes can link to it (`[[Predestination (2014)]]` from a journal entry). It writes one note per page of the site, in the format and folders the Obsidian plugin used (`Movies`, `TVs`, `Seasons`, `Juegos`, `Books`) and with the same file names, so existing links keep working and the old Hugo migration script can still read the folder. Any edit made in Obsidian to these notes is overwritten on the next run.

Without `--apply` it only reports which notes would be created, changed or removed. With `--apply` it writes through a temporary file and a rename, and only notes whose text changes. Properties the database does not hold (`related`, `aliases`, `cssclasses`, `category`...) stay as written, and so do values that already mean the same thing: a cover URL or `[[file]]` for the same image, season links written with folders or aliases, a review whose only difference is how its images are embedded. A series with season notes gets its status from its seasons (in progress while one is, completed once one is finished and the rest are not started) and the latest finish date; it has no rating of its own.

Covers keep their original URL when the image came from one; otherwise the note links a file in `Portadas` or `Files` with the same bytes, or the image is copied there as `metrack-<hash>.<ext>`. `--web-url` (or `VAULT_MIRROR_WEB_URL`) adds a `metrack` property linking to the item in the web app. `--link-prefix` is the folder's path inside the vault, `Media Tracker` by default.

The notes written are recorded in `vault-mirror-state.json` in the data directory. A note the mirror wrote before and that no longer matches an item (deleted, or renamed) is removed; notes it never wrote are listed and left alone.

### Automatic mirror

For every user with a vault folder in their settings (`mirrorDir`, see Per-user settings), the server runs the mirror once at start and again a few seconds after every successful write under `/api` (the same trigger as publishing), so the vault follows every edit. `VAULT_MIRROR_WEB_URL` and the `mirrorLinkPrefix` setting work like the CLI options; `metrack mirror --user <id>` mirrors another user's notes. Failures are logged, retried with backoff and reported once through the user's ntfy topic. When the server runs as root (the Docker image), written files and folders take the owner of the folder they are written into, so the vault keeps belonging to its user. In Docker, mount the vault folder and set it for the user (`metrack users set 1 --mirror-dir "/vault/Media Tracker"`, or `VAULT_MIRROR_DIR` before the first start):

```yaml
environment:
  VAULT_MIRROR_WEB_URL: http://192.168.1.15:8100
volumes:
  - /path/to/vault/Media Tracker:/vault/Media Tracker
```

## Exporting to Hugo

```sh
npm run metrack -w @metrack/server -- export /path/to/site
```

`export` reads the database and image store in `DATA_DIR` (or `--data-dir`) and writes `content/movies`, `content/tv`, `content/seasons`, `content/games` and `content/books` under the output directory, replacing those sections and leaving everything else alone. The tree is what the current `hugo-mediatracker-theme` expects: one page bundle per item named like the old note (the vault file name is kept as `slug`, so page addresses stay the same), the cover and banner next to `index.md`, and the review as the page body with wikilinks to known pages turned into `ref` links and YouTube links into shortcodes. The output is deterministic: the same data always produces the same files. Images that came from a remote URL keep the file name the old migration script gave them, other images are named by hash.

A series with season notes exports a `tv` page that only groups its seasons (status `not_started`, plus its review) and one `seasons` page per season; a series whose only season has no note exports a single `tv` page carrying that season's tracking. Items without a stored name get one derived from their title and year. Books are exported to `content/books`, which the theme does not list yet.

`export` does not write the Hugo project itself (`hugo.toml`, layouts, data files, static pages such as `about.md`): those live in a site template directory that is never modified.

## Publishing

The service builds the site and uploads it to Cloudflare Pages by direct upload (`wrangler pages deploy`), so images never go through git. The image ships both tools at pinned versions, set by the `HUGO_VERSION` and `WRANGLER_VERSION` build arguments in the `Dockerfile`: Hugo extended (checksum verified at build time) and wrangler, installed globally, so publishing needs no download at runtime. Wrangler receives the Cloudflare credentials plus only an allowlist of the server's environment (`WRANGLER_INHERITED_ENV`: paths, locale, proxy and CA variables). Each user with a Cloudflare Pages project in their settings (`publishProject`, see Per-user settings) gets their own site, built from their library. Publishing is event driven: any successful write under `/api` marks the sites as changed, `POST /api/publish` does the same for the signed-in user's site, and a short debounce turns a burst of edits into one attempt. An attempt exports the data and compares its fingerprint with the last published one, so nothing is built or uploaded when the site would be identical. Otherwise it copies the site template, adds the export, runs `hugo` and uploads the result. A failed attempt is retried with exponential backoff (1 minute, doubling, up to 1 hour). A run of failures sends one ntfy alert to the user's topic (otherwise only logged), and one more message when a publish succeeds again. `hugo` runs with an allowlist of the environment as well (`HUGO_INHERITED_ENV`: paths, locale, `HUGO_*`, the Go module variables, proxies and CAs), so no credential of the server reaches the theme build.

Publishing stays off, with a log line naming what is missing, unless all of these are set. Credentials are only ever read from the environment; the project and the site address are per-user settings.

- `PUBLISH_SITE_TEMPLATE_DIR`: Hugo project without the exported content sections.
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account the Pages projects belong to.
- `HUGO_BIN` (default `hugo`), `WRANGLER_BIN` (default `wrangler`) and `CLOUDFLARE_PAGES_BRANCH` (default `main`).

The `publishBaseUrl` setting (optional, user 1 starts from `PUBLISH_BASE_URL`) is the public address of the site, passed to Hugo as `--baseURL`. Set it to the address the site is served from (for example `https://my-site.pages.dev/`): without it the template's `baseURL` applies, and a relative one makes the RSS feeds emit relative links and cover URLs that feed readers cannot resolve.

The image does not include Go, so the theme's Hugo modules must be vendored in the site template (`hugo mod vendor`, which writes `_vendor/`); with them vendored the build needs no network. The old MediaTracker site builds this way inside the image. The upload to Cloudflare is not covered by automated tests: the publisher is tested with a fake command runner and the pipeline with a fake publisher. Changes to the site template alone do not trigger a publish, because the fingerprint covers only the exported content.

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

`NTFY_URL` and `NTFY_TOKEN` are also the server every user's alerts go through, to the topic in their settings; `NTFY_TOPIC` is only for instance alerts such as backups, and the starting topic of user 1.

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

The service can compare what was played in Jellyfin with the tracking. The structure (seasons, episodes, provider ids) comes from the Jellyfin API and the dates from Jellystat's `jf_playback_activity` table, read directly from its Postgres database in a read-only session. Jellyfin 12 only accepts the `Authorization: MediaBrowser Token="..."` header, which is what the client sends. Jellystat only records real playback, so items marked as watched by hand never show up. Syncing is off unless the four required variables are set, and then runs for each user with a Jellyfin account in their settings (`jellyfinUser`, see Per-user settings); a user without one is never synced, so nobody's viewings are read for them.

| Variable                                     | Default                   | Meaning                                             |
| -------------------------------------------- | ------------------------- | --------------------------------------------------- |
| `JELLYFIN_URL`, `JELLYFIN_TOKEN`             | required                  | Jellyfin address and an API key                     |
| `JELLYSTAT_DB_HOST`, `JELLYSTAT_DB_PASSWORD` | required                  | Jellystat Postgres host and password                |
| `JELLYSTAT_DB_PORT`, `_USER`, `_NAME`        | 5432, postgres, jellystat | Rest of the connection                              |
| `SYNC_TIME_ZONE`                             | `Europe/Madrid`           | Time zone that decides on which day a viewing falls |
| `SYNC_WEBHOOK_DELAY_SECONDS`                 | 120                       | Quiet time after a webhook before the sync runs     |
| `SYNC_WEBHOOK_SECRET`                        | unset                     | Secret the webhook must send (16+ characters)       |

Rules: an item counts as watched when 90% of its runtime was played in one day, or, when playback never reaches that because intros and credits were skipped, when Jellyfin marks it as played for the tracked account (the day with the most playback is used). A watched movie without a finish date completes with that day, and later viewings become rewatches (a viewing the day after the recorded date is taken as the same one). The first watched episode puts the season in progress with `started_at`; once every episode is watched and none is still to air the season completes with `finished_at` set to the day the last one was first watched. Ratings, reviews and notes are never touched. Every movie viewing the sync records (a first viewing or a rewatch) and every season it completes is marked as pending review: the title is published, but the site feeds leave it out until it is confirmed in the web app (Save and confirm), so a feed entry never goes out before the rating and review are written. Library seasons are paired with stored seasons by Jellyfin id, a season override, the date of the first episode (never the number, so TMDB season 3 pairs with Jellyfin season 4 for Lupin) and finally the number for stored seasons that have no air date. Series are paired with stored ones by TheTVDB id, then TMDB id; when Jellyfin only has the TheTVDB id and `TMDB_API_KEY` is set, the TMDB id is looked up first, so a series added from TMDB is not created twice. Movies and series the sync creates get their TMDB metadata and artwork right after the write (a failed refresh leaves them as created). Titles without any id go to the unlinked inbox. Playback of items that left the library or came back under new ids cannot be matched and is only counted.

To sync without clicking, point the Jellyfin Webhook plugin at `POST /api/sync/webhook`. The body is ignored: every request queues one sync for each user with a Jellyfin account after `SYNC_WEBHOOK_DELAY_SECONDS` of quiet (so Jellystat has recorded the playback), a burst of events is one run, an event during a run triggers another afterwards, and failures retry with backoff and alert through ntfy. What the sync writes is published and mirrored like any other edit. In the plugin add a Generic destination with that URL, a JSON body such as `{"event": "{{NotificationType}}"}`, the `Content-Type: application/json` header, the notification types Playback Stop and User Data Saved, and your user as the only user filter. Set `SYNC_WEBHOOK_SECRET` (for example `openssl rand -hex 32`) once metrack is reachable from outside the local network: requests without it answer 401. Send it in an `X-Webhook-Secret` header (another header in the same Generic destination), or, for a sender that cannot set headers, as `?token=<secret>` in the URL (masked in metrack's logs, but a URL can end up in other logs, so prefer the header).

The first pass is report only:

```sh
node --disable-warning=ExperimentalWarning apps/server/dist/cli.js sync --verbose
curl http://localhost:8097/api/sync/report
```

`sync` (as user 1, or `--user <id>`) without `--apply` opens the database read-only. `sync --apply` and `POST /api/sync/apply` with `{ "confirm": true }` recompute the plan for the signed-in user and write it in one transaction. The settings page has the same two steps.

## Release alerts

Following a series (`follow`) or a movie puts it on the watchlist (the "Following" page, or the button on its page). A worker asks TMDB about every followed title and sends an ntfy notification, with the poster attached, once per (movie or season, kind):

- `releases_tomorrow` the day before the release and `releases_today` on the day. These only fire on their exact day, so a late warning is never sent.
- `available_es` when TMDB lists a `flatrate` provider for Spain (`buy` and `rent` are ignored) for a release that happened in the last 14 days (seasons) or 60 days (movies).

The release date of a season is its `air_date`, or the date of `next_episode_to_air` when that is the first episode and the season has no date yet. For a movie it is the earliest Spanish premiere or limited release in `release_dates`, falling back to `release_date`. When TMDB announces a season of a followed series that is not stored, the season is created as `planned`. It is paired with an existing season by its stored TMDB number, then by the date of its first episode, and a season override can give it another number. Seasons that are missing locally but were released long ago are left alone. When the season shows up in Jellyfin under another number, the Jellyfin sync pairs it by date, so nothing is duplicated.

How often a title is asked about depends on how close its release is: every 30 minutes from the day before to the day after, every 3 hours while providers may still be catching up, and twice a day otherwise. The scheduler ticks every 10 minutes and keeps the due times in memory. Nothing is checked or sent before `ALERTS_NOTIFY_FROM_HOUR`, so alerts do not arrive at night. An alert is recorded in `release_alert` only once ntfy has accepted it, and recorded alerts are listed on the Following page; an alert ntfy does not accept stays pending and is retried 30 minutes later. Every user with an ntfy topic in their settings (`ntfyTopic`) gets alerts for what they follow, with their own due times. Alerts need `TMDB_API_KEY` and `NTFY_URL`.

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

## License

[MIT](LICENSE)
