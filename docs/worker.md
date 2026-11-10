# metrack on Cloudflare Workers

`apps/server/src/worker` builds the same Hono app as the home server over D1 (`createD1Repositories`) and R2 (`R2ImageBlobStore`), with `IMAGE_ENCODED_BY=client` forced (a Worker cannot run sharp: the browser recodes images to WebP and the Worker only validates them). The web app is served as Static Assets of the same Worker, so the session cookie is same-origin and there is no CORS. `apps/server/wrangler.jsonc` describes the Worker `metrack-test`, its D1 database `metrack-test`, its R2 bucket `metrack-test-images` and its assets. Nothing in it is scheduled: there are no cron triggers.

API routes, `/u/*` (public pages) and `/privacy` run the Worker first. Every other path is answered by the assets, falling back to `index.html` for the web app's routes.

## Run it locally

Local D1 and R2 live under `apps/server/.wrangler` (Miniflare); nothing reaches a Cloudflare account.

```sh
npm ci
cp apps/server/.dev.vars.example apps/server/.dev.vars   # optional: provider keys, DEV_LOGIN=true
cd apps/server
npx wrangler d1 migrations apply metrack-test --local
npx wrangler d1 execute metrack-test --local --file d1/seed/test-data.sql
node d1/seed/makeTestToken.mjs > /tmp/token.sql          # prints the token on stderr, once
npx wrangler d1 execute metrack-test --local --file /tmp/token.sql
cd ../..
npm run worker:dev                                       # builds the libraries and the web app, then wrangler dev
```

Then call the API with `curl -H "Authorization: Bearer <token>" http://localhost:8787/api/media`. The web app needs a session cookie, and the only way to get one today is `DEV_LOGIN=true` in `.dev.vars` (local only).

## Test data

`apps/server/d1/seed/test-data.sql` creates a made-up owner (user 1, handle `test`, public page on) and one movie, one series with a season, one game and one book. `makeTestToken.mjs` prints an `INSERT` for a random API token (SHA-256 only is stored) and the token itself on stderr. The schema file holds no data, so a fresh database has no users until a seed runs. Add `--remote` instead of `--local` to run the same commands against the deployed database.

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

- Sign in: only personal API tokens (`Authorization: Bearer`) work on a deployed Worker. The web app has no sign-in there until Google login exists.
- Jellyfin and Jellystat sync (`/api/sync/*` answer 501), the Jellyfin webhook included.
- The vault mirror and Hugo/Cloudflare Pages publishing (`/api/publish` does not exist).
- Backups (`/api/backups` does not exist) and the archive of images.
- Release alerts and ntfy notifications: there is no timer.
- Erasing deleted accounts: a deletion can be scheduled, but nothing runs the job that carries it out after the grace period.
- Server-side image recoding: uploads must already be WebP.
- Caching with the Cache API (a no-op on `workers.dev`).
- Indexes beyond those in `0001_schema.sql`.
