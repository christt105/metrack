# metrack on Cloudflare Workers

`apps/server/src/worker` builds the same Hono app as the home server over D1 (`createD1Repositories`) and R2 (`R2ImageBlobStore`), with `IMAGE_ENCODED_BY=client` forced (a Worker cannot run sharp: the browser recodes images to WebP and the Worker only validates them). The web app is served as Static Assets of the same Worker, so the session cookie is same-origin and there is no CORS. `apps/server/wrangler.jsonc` describes the Worker `metrack-test`, its D1 database `metrack-test`, its R2 bucket `metrack-test-images` and its assets. Nothing in it is scheduled: there are no cron triggers.

API routes, `/u/*` (public pages), `/privacy` and `/assets/*` run the Worker first. `/assets/*` is answered from the assets binding, with a JSON 404 (`Cache-Control: no-store`) for a missing file instead of `index.html`. Every other path is answered by the assets, falling back to `index.html` for the web app's routes.

## Run it locally

Local D1 and R2 live under `apps/server/.wrangler` (Miniflare); nothing reaches a Cloudflare account.

```sh
npm ci
cp apps/server/.dev.vars.example apps/server/.dev.vars   # optional: provider keys, DEV_LOGIN=true
cd apps/server
npx wrangler d1 migrations apply metrack-test --local            # applies 0001 and 0002
npx wrangler d1 execute metrack-test --local --file d1/seed/test-data.sql
node d1/seed/makeTestToken.mjs > /tmp/token.sql          # prints the token on stderr, once
npx wrangler d1 execute metrack-test --local --file /tmp/token.sql
cd ../..
npm run worker:dev                                       # builds the libraries and the web app, then wrangler dev
```

Then call the API with `curl -H "Authorization: Bearer <token>" http://localhost:8787/api/media`. The web app needs a session cookie: open it, paste the token in "Sign in with an access token" on the login screen (`POST /api/auth/token-login`, `write` tokens only) and you get a normal session. `DEV_LOGIN=true` in `.dev.vars` also works locally, but must never be enabled on a public Worker.

## Test data

`apps/server/d1/seed/test-data.sql` creates a made-up owner (user 1, handle `test`, public page on) and one movie, one series with a season, one game and one book. `makeTestToken.mjs` prints an `INSERT` for a random API token (SHA-256 only is stored) and the token itself on stderr. The schema file holds no data, so a fresh database has no users until a seed runs. Add `--remote` instead of `--local` to run the same commands against the deployed database.

## Bulk test data and read measurements

`apps/server/d1/seed/makeBulkData.mjs` prints deterministic SQL for a second user (id 2, handle `bulk`, role `trusted`, public page on) with made-up titles: 80 movies, 65 series with 90 seasons, 90 games and 30 books, about half rated or reviewed, some rewatches, tags, genres and covers and banners pointing at `images.example.org` (no R2 objects needed). It only adds rows, so it applies on top of `0001_schema.sql`, the later migrations and `test-data.sql`, and user 1 is untouched:

```sh
cd apps/server
node d1/seed/makeBulkData.mjs > /tmp/bulk.sql
npx wrangler d1 execute metrack-test --local --file /tmp/bulk.sql
```

`npm run measure:reads -w @metrack/server` runs entirely in Miniflare (nothing reaches Cloudflare): it applies every migration, `test-data.sql` and the bulk data, wraps the D1 binding to sum `meta.rows_read` and `meta.rows_written` per request, then calls the public pages, `index.json`, `feed.xml`, an image, and as the bulk user `GET /api/media`, a title detail, `/api/account`, `/api/settings` and a `PATCH`. Each route runs cold (content version bumped, nothing stored), warm, and for pages revalidated with `If-None-Match`. It prints rows read and written and the local wall time per call (Miniflare time, not Worker CPU), then estimates a day against the free limits (5M rows read, 100k rows written, the latter shared with another project). `METRACK_PROFILE='{"public home":200}'` overrides visits per route and `METRACK_WRITES_PER_DAY` (default 5) sets how many owner edits a day invalidate the stored pages.

## Public render cache

Public pages (`/u/<handle>/`, stats, collage, about, `index.json`, `feed.xml`, one page per item) would otherwise read the whole library on every visit. The Worker stores each rendered page in D1 instead (`public_render`, migration `0002_public_render_cache.sql`):

- `user.content_version` counts the changes of a user's data. `bumpContentVersionOnWrite` raises it once after every successful `POST`, `PUT`, `PATCH` or `DELETE` under `/api` made by a signed-in user (status below 400), so every write path is covered without touching the repositories, the profile and avatar settings of the public page included. Failed writes, reads and anonymous requests leave it alone.
- A public request resolves the handle, the switch, the content version and the stored row for that page in one query (about 3 rows read). The stored body is used only when its version equals the current one and it is under a day old; otherwise the page is rendered from the library, stored with `INSERT OR REPLACE` and served. Writes never rebuild anything, they only bump the version, so bulk operations cannot cause rebuild loops. Bodies over 1 MB are served but not stored.
- The cache key is the page (`home`, `stats`, `collage`, `about`, `index.json`, `movie/12`, ...). No renderer reads a query parameter, so none is part of the key. The feed links to the visitor's address unless `PUBLIC_URL` is set, so its key includes that address.
- Pages answer `Cache-Control: no-cache` with a strong `ETag` of user id, content version and key; a matching `If-None-Match` gets 304 for the cost of the same single query.
- `/u/<handle>/images/<hash>` checks the hash against a stored list of the images the page publishes (key `published-images`) instead of loading the library, and is served `public, max-age=31536000, immutable` because the hash names the content.
- Old rows are overwritten in place when their page is next visited and deleted with the user, so there is no cleanup job.

The home server does not need it: it has no row or CPU budget, so `buildApp` is given neither a `renderCache` nor `contentVersions` there and renders on every request (no `ETag`). The `user.content_version` column and `public_render` table exist only in the D1 migration; the TypeScript migrations and the home schema are unchanged, and `D1Schema.test.ts` checks that `0002` adds exactly those two things on top of the schema that matches them. Because the version is only bumped by requests, anything that writes a user's data outside a request must call `ContentVersions.bump` too (Jellyfin sync, imports, the erasing job); none of those runs on the Worker today, and if the cache is ever enabled at home, they must be wired to it.

A stored render also expires after 24 hours (`RENDER_MAX_AGE_SECONDS`, `rendered_at` in epoch seconds), so changes the version cannot see, such as edits to shared catalog rows made through another user's request (a metadata refresh) or the footer year, show up within a day. The ETag also carries `rendered_at` (`"<userId>.<version>.<renderedAt>.<key>"`), so a page re-rendered after expiry gets a new ETag, and an expired or missing row never answers 304.

## Deploy

```sh
cd apps/server
npx wrangler login
npx wrangler d1 create metrack-test          # put the printed database_id in wrangler.jsonc
npx wrangler r2 bucket create metrack-test-images
npx wrangler d1 migrations apply metrack-test --remote
npx wrangler d1 execute metrack-test --remote --file d1/seed/test-data.sql
node d1/seed/makeTestToken.mjs > /tmp/token.sql
npx wrangler d1 execute metrack-test --remote --file /tmp/token.sql
npx wrangler secret put TMDB_API_KEY         # likewise IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, STEAMGRIDDB_TOKEN
cd ../..
npm run worker:deploy
```

Provider keys are Worker secrets read from the environment bindings; without one, search for that type answers 501 `provider_not_configured` (books come from Open Library and need none). Never set `DEV_LOGIN` on a deployed Worker.

## What the cloud does not do yet

- Sign in: only personal API tokens work on a deployed Worker, either as `Authorization: Bearer` or through the web token sign-in form (`POST /api/auth/token-login`). Google login is pending.
- Jellyfin and Jellystat sync (`/api/sync/*` answer 501), the Jellyfin webhook included.
- The vault mirror and Hugo/Cloudflare Pages publishing (`/api/publish` does not exist).
- Backups (`/api/backups` does not exist; `GET /api/health` reports `features.backups: false`, so Settings hides the section) and the archive of images.
- Release alerts and ntfy notifications: there is no timer.
- Erasing deleted accounts: a deletion can be scheduled, but nothing runs the job that carries it out after the grace period.
- Server-side image recoding: uploads must already be WebP.
