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

The service builds the site and uploads it to Cloudflare Pages by direct upload (`wrangler pages deploy`, fetched with `npx` on first use), so images never go through git. Publishing is event driven: any successful write under `/api` marks the site as changed, `POST /api/publish` does the same on request, and a short debounce turns a burst of edits into one attempt. An attempt exports the data and compares its fingerprint with the last published one, so nothing is built or uploaded when the site would be identical. Otherwise it copies the site template, adds the export, runs `hugo` and uploads the result. A failed attempt is retried with exponential backoff (1 minute, doubling, up to 1 hour) and every failure goes through the `Notifier`; today that only logs, and it will use the ntfy notifier of the backups module once that is merged.

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
- `vue`, `vite`, `@vitejs/plugin-vue`, `vue-tsc`: the frontend.
- `yaml`: parses note frontmatter (quoted strings, block lists, multi-line values) and quotes values when writing front matter for Hugo, both of which a hand-written implementation would get subtly wrong; zero dependencies of its own.
- `vitest`, `eslint`, `prettier`, `typescript`, `tsx`: tests, lint, formatting, type checking and dev reload.

## Migrations

Migrations are TypeScript modules in `apps/server/src/storage/migrations`, numbered contiguously from 1 and registered in `index.ts`. They run in order at startup, each in its own transaction, and are recorded in `schema_migrations`.
