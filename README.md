# metrack

Self-hosted media tracker: movies, series (tracked per season), games and books, stored in SQLite and served by a single container. This is the service skeleton: a health route, versioned migrations and a Vue shell.

## Layout

- `packages/domain`: pure domain logic, no HTTP or database.
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

## Dependencies

- `node:sqlite` (built into Node 22): avoids a native module and a build toolchain in the image; it is still marked experimental, so it is confined to `apps/server/src/storage` and the image silences its warning.
- `fastify` and `@fastify/static`: routing, in-process request injection for tests and static file serving with little code.
- `vue`, `vite`, `@vitejs/plugin-vue`, `vue-tsc`: the frontend.
- `yaml`: parses note frontmatter (quoted strings, block lists, multi-line values), which a hand-written parser would get subtly wrong; zero dependencies of its own.
- `vitest`, `eslint`, `prettier`, `typescript`, `tsx`: tests, lint, formatting, type checking and dev reload.

## Migrations

Migrations are TypeScript modules in `apps/server/src/storage/migrations`, numbered contiguously from 1 and registered in `index.ts`. They run in order at startup, each in its own transaction, and are recorded in `schema_migrations`.
