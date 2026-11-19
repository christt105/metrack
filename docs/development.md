# Developing metrack

## Layout

- `packages/domain`: pure domain logic, no HTTP or database.
- `packages/site`: pure renderer of the public pages (HTML, RSS and the theme's stylesheet, scripts, font and images) from one user's data; no database, no disk, no Node-only APIs.
- `packages/export`: pure builder of the vault mirror notes from stored data, plus the helpers the public pages share.
- `apps/server`: Hono API, SQLite storage and migrations; also serves the built web app.
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

The HTTP API used by the private editing interface is documented in [api.md](api.md); its types live in `@metrack/domain`.

The Cloudflare Workers build (D1, R2, Static Assets) is described in [worker.md](worker.md), including the tag-driven production deploy. The Worker cannot reach Jellyfin, so a second mode of the same image, the home connector (`metrack connector`), reads Jellyfin and Jellystat at home and syncs into it; see [connector.md](connector.md).

Run the API with `npm run dev:server` (port 8097, data in `./data`) and the web app with `npm run dev:web`, which proxies `/api` to the API.

## Dependencies

- `node:sqlite` (built into Node 22): avoids a native module and a build toolchain in the image; it is still marked experimental, so it is confined to `apps/server/src/storage` and the image silences its warning.
- `hono` (MIT, no dependencies of its own) and `@hono/node-server` (MIT): routing on web-standard `Request` and `Response`, so the same app can later run outside Node; the Node adapter, the static files and `node:sqlite` stay in Node-only modules (`main.ts`, `web/`, `storage/`). Tests send requests in-process through `app.request`.
- `pg`: the only way to read Jellystat, which exposes its history through its own login-protected API and its Postgres database; used for one read-only query.
- `vue`, `vite`, `@vitejs/plugin-vue`, `vue-tsc`: the frontend.
- `yaml`: parses note frontmatter (quoted strings, block lists, multi-line values) and quotes values when writing front matter, both of which a hand-written implementation would get subtly wrong; zero dependencies of its own.
- `vitest`, `eslint`, `prettier`, `typescript`, `tsx`: tests, lint, formatting, type checking and dev reload.

## Migrations

Migrations are TypeScript modules in `apps/server/src/storage/migrations`, numbered from 1 and registered in `index.ts`; versions only have to increase, so a number can be left free for a branch that has not landed yet. At startup every migration not yet recorded in `schema_migrations` runs, in order and each in its own transaction, even one numbered below the latest already applied.
