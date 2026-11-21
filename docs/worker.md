# metrack on Cloudflare Workers

`apps/server/src/worker` builds the same Hono app as the home server over D1 (`createD1Repositories`) and R2 (`R2ImageBlobStore`), with `IMAGE_ENCODED_BY=client` forced (a Worker cannot run sharp: the browser recodes images to WebP and the Worker only validates them). The web app is served as Static Assets of the same Worker, so the session cookie is same-origin and there is no CORS. `apps/server/wrangler.jsonc` describes (at the top level) the Worker `metrack-test`, its D1 database `metrack-test`, its R2 bucket `metrack-test-images` and its assets. Its one cron trigger, `0 * * * *` (hourly), erases deleted accounts (see Scheduled tick).

The Worker runs first for every path except the static files of the web app that are never HTML: `run_worker_first` is `/*` minus `/sw.js`, `/manifest.webmanifest`, `/favicon.svg`, `/apple-touch-icon.png` and the `icon*` files, so those are answered by the assets binding without a Worker invocation (a test keeps the exclusions equal to the files in `apps/web/public`). API routes, `/u/*` and `/privacy` go to the Hono app. `/assets/*` is answered from the assets binding, with a JSON 404 (`Cache-Control: no-store`) for a missing file instead of `index.html`. Every other path (`/`, `/login`, `/settings`, `/movies/1`) is fetched from the assets binding by `serveApp`, which falls back to `index.html` for the web app's routes, and gets its security headers there.

Request cost: before, only API calls, public pages and `/assets/*` invoked the Worker; now every page navigation does too, one extra invocation per HTML load. The service worker (`/sw.js`), the manifest and the icons still cost none. Hashed assets already ran the Worker first. The daily free-plan request budget is shared with another app, so keep this in mind if navigations grow.

Every response carries the same fixed security headers (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and `Strict-Transport-Security` over HTTPS). The Hono app and `serveAsset` add them from `apps/server/src/api/securityHeaders.ts`; the paths the assets binding answers without running the Worker cannot, so `apps/web/public/_headers` (copied into the build output, never served as a file) lists the same headers for them, and a test keeps both lists equal. The home server adds them through the same Hono middleware.

### Content security policy

Every response also carries an enforcing `Content-Security-Policy` header, so a browser blocks what the policy does not allow. There are two policies, both defined once in `apps/server/src/api`: `APP_CONTENT_SECURITY_POLICY` (the single-page app, the API and every other path) and `PUBLIC_CONTENT_SECURITY_POLICY` (`/u/*` and `/privacy`, which need inline styles and the giscus script and frame). `contentSecurityPolicyFor` picks one by request path and `withSecurityHeaders` adds it, never replacing a policy a response already sets, except on HTML documents (see below), on the home server and in the Worker alike. `apps/web/public/_headers` carries only the other security headers: the policy is irrelevant to the static files it still covers, and every HTML response goes through the Worker.

Cloudflare Bot Fight Mode injects JavaScript Detections into every HTML response served through a custom domain (not on `workers.dev`) for a visitor without a `cf_clearance` cookie: an inline script before `</body>` that creates a hidden iframe with another inline script carrying a per-request ray id, a same-origin script under `/cdn-cgi/challenge-platform/` (covered by `'self'`), and a hidden element with an inline `style` attribute. A hash cannot match the inline scripts, since the ray id changes per request. Cloudflare adds a nonce to the scripts it injects by parsing the CSP response header (a nonce in a `<meta>` tag is not supported). So `withSecurityHeaders` gives every HTML document (and a 304 for one) a fresh random nonce (`generateCspNonce`, 128 bits from `crypto.getRandomValues`), added to `script-src` by `withScriptNonce`, and overwrites any policy the document came with. The nonce only lives in the header; our own pages load external scripts and the cached public HTML bodies never contain it, so the render cache and its ETag are unaffected. The public `style-src` keeps `'unsafe-inline'` with no nonce or hash, because either would make a browser ignore `'unsafe-inline'`. The app `style-src` allows the injected element's `style` attribute with `'unsafe-hashes' 'sha256-Ia8f7Xd1GU9rNhtqyt5pM4QjRB9pqCkMhfAkkeE4+l4='`.

That is why the single-page app's HTML goes through the Worker: the assets binding alone cannot add a per-request nonce. The injection only exists on the custom domain, so the final check is a walk of the production site in a browser with an empty cookie jar, reading the console.

The policies are enforced. Before that they ran report-only on v0.25.0, and a production walk with fresh browser profiles found 0 violations across the app HTML, the public pages, `/privacy` and the Cloudflare Bot Fight Mode injected script carrying the nonce.

There is no report endpoint (no `report-uri` or `report-to`). Violations show in the browser console, so check a policy change by walking the app and the public pages in a real browser and reading the console messages. To roll back quickly, run `npx wrangler rollback <previous version id> --env production`, or set `CONTENT_SECURITY_POLICY_HEADER` back to `Content-Security-Policy-Report-Only`, which makes the policies report without blocking.

## Run it locally

Local D1 and R2 live under `apps/server/.wrangler` (Miniflare); nothing reaches a Cloudflare account.

```sh
npm ci
cp apps/server/.dev.vars.example apps/server/.dev.vars   # optional: provider keys, DEV_LOGIN=true
cd apps/server
npx wrangler d1 migrations apply metrack-test --local            # applies 0001 to 0005
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
- The cache key is the page (`home`, `stats`, `collage`, `about`, `index.json`, `movie/12`, ...). No renderer reads a query parameter, so none is part of the key. The feed links to the visitor's address unless `PUBLIC_URL` is set, so its key includes that address. Every key also carries the owner's language (`home#es`, `home#en`): the lookup reads it with the user row, so changing it is served in the new language on the next visit and the ETag differs per language.
- Pages answer `Cache-Control: no-cache` with a strong `ETag` of user id, content version and key; a matching `If-None-Match` gets 304 for the cost of the same single query.
- `/u/<handle>/images/<hash>` checks the hash against a stored list of the images the page publishes (key `published-images`) instead of loading the library, and is served `public, max-age=31536000, immutable` because the hash names the content.
- Old rows are overwritten in place when their page is next visited and deleted with the user, so there is no cleanup job.

The home server does not need it: it has no row or CPU budget, so `buildApp` is given neither a `renderCache` nor `contentVersions` there and renders on every request (no `ETag`). The `user.content_version` column and `public_render` table exist only in the D1 migration; the TypeScript migrations and the home schema are unchanged, and `D1Schema.test.ts` checks that `0002` adds exactly those two things on top of the schema that matches them. Because the version is only bumped by requests, anything that writes a user's data outside a request must call `ContentVersions.bump` too (Jellyfin sync, imports); none of those runs on the Worker today (the scheduled erasing deletes the user and its `public_render` rows, so it needs no bump), and if the cache is ever enabled at home, they must be wired to it.

A stored render also expires after 24 hours (`RENDER_MAX_AGE_SECONDS`, `rendered_at` in epoch seconds), so changes the version cannot see, such as edits to shared catalog rows made through another user's request (a metadata refresh) or the footer year, show up within a day. The ETag also carries `rendered_at` (`"<userId>.<version>.<renderedAt>.<key>"`), so a page re-rendered after expiry gets a new ETag, and an expired or missing row never answers 304.

## Scheduled tick

`wrangler.jsonc` declares one cron trigger, `0 * * * *` (hourly), at the top level. Wrangler inherits `triggers` into `env.production` (`unstable_readConfig` for `--env production` reports the same single cron), so the production Worker has exactly that one cron too; do not repeat it there. The Worker's `scheduled` handler (`createWorkerHandler`) builds the same services as `fetch` once per isolate (`createWorkerServices`; the Hono app is only built by a request) and runs `ScheduledTick`, which erases at most one due account per tick and fills in the running time of up to 20 movies that lack one (`MovieRuntimeBackfill`, one TMDB request per movie, stops at the first failure; the home server runs the same backfill hourly) and, only when it erased nobody and filled in no movie, prepares the artwork of games the Steam import left pending (`GameArtworkBackfill` with a budget of 30 subrequests, about 1 to 2 games; see [steam-import.md](steam-import.md)) (its D1 rows in one `batch`; there is no data directory to clean). It does not delete the account's images: the home connector removes orphan images from D1 and R2 once a day (`docs/connector.md`, section 9). That is a capacity of 24 accounts a day; the rest wait for the next tick. One line per tick, `scheduled tick <time>: erased=N` (with ` runtimes=N` and ` artwork=N` when those ran), is visible with `wrangler tail`. A failing account is logged and the handler never rejects. The tick does not refresh Steam achievements: they cost one Steam request per game and are refreshed from the browser (see [steam-import.md](steam-import.md)).

Release alerts are not run by the Worker: they stay on the home server (`ReleaseWatcher`).

Limits per invocation on the Workers Free plan: 10 ms CPU, 50 subrequests to external hosts and 1000 to Cloudflare services (every D1 statement counts, so does each R2 call). Measured on the test Worker: a tick that finds nothing to erase took 4 to 14 ms of CPU (most of it starting the isolate), erasing an empty account 10 ms, and erasing an account with 61 followed series and one owned image 13 ms and about 1 s of wall time, with no external subrequests; every invocation ended `ok`. Those measurements are from before the Worker stopped deleting images on erase: finding the orphans read every image row (`ImageStore.removeUnused`), so the cost grew with the images stored for all users, and deleting each image took four Cloudflare calls, which hit the 1000 call limit at about 250 images.

Trigger a tick locally (no Cloudflare account involved):

```sh
cd apps/server
npx wrangler dev --test-scheduled
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+*+*+*+*"
```

`/__scheduled?cron=...` is the older route of `--test-scheduled`; the Worker's assets would answer it with `index.html` (the Worker hands it to the assets), so use `/cdn-cgi/handler/scheduled`. The tick line shows in the `wrangler dev` output.

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
npx wrangler secret put TMDB_API_KEY         # likewise IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, STEAMGRIDDB_TOKEN, STEAM_API_KEY
cd ../..
npm run worker:deploy
```

Provider keys are Worker secrets read from the environment bindings; without one, search for that type answers 501 `provider_not_configured` (books come from Open Library and need none). Never set `DEV_LOGIN` on a deployed Worker.

## Sign in with Google

Google sign-in lets users that already exist sign in with their Google account, and lets a friend with a valid invitation link create their account (see below). Without a valid invitation it never creates users. Token login stays available as the owner's fallback.

1. In the Google Cloud Console, create an OAuth client of type "Web application" (consent screen scopes: `openid`, `email` and `profile`).
2. Add the authorized redirect URIs `https://metrack.hakulino.dpdns.org/api/auth/google/callback` (production) and `https://metrack-test.christt105.workers.dev/api/auth/google/callback` (test).
3. Give the Worker the client: `GOOGLE_CLIENT_ID` as a var or secret and `GOOGLE_CLIENT_SECRET` as a secret.

```sh
cd apps/server
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID --env production
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

Both must be set or neither: with only one, the Worker fails when it starts. Without them the Google routes do not exist and the sign-in page shows no button. The D1 migration `0004_google_login.sql` adds the nullable, unique `user.google_sub` column, so apply migrations before deploying.

Linking: the first time a Google account signs in, it is matched by its email (only when Google says the email is verified) to a user with the same email and no Google account yet, and its `sub` is stored on that user from then on. Later sign-ins match by `sub`. A Google account with no match and no valid invitation is refused with no session. Users with no email, or with a different one, are linked from the home server with `metrack users set <id> --google-sub <sub>` (an empty value unlinks); `metrack users` marks linked users with `[google]`.

Invitations: the owner creates links in settings (`/invite/<code>`, with a number of uses and an expiry) and sends them, for example through WhatsApp with the Web Share API. The migration `0005_invites.sql` adds the `invite` and `invite_use` tables and `user.onboarded_at`, which is null for a user created through an invitation until they confirm their name and handle on first entry; it sets it for every existing user, so apply it before deploying. A person who signs in with Google through a valid link gets a `normal` user with the Google name and the verified email, and one use is spent in the same D1 `batch` that inserts the user. The email is stored and shown only to the owner in the accounts panel of settings; the privacy page says so. The seed files set `onboarded_at` on their users.

The home instance on a plain-http LAN address cannot use Google sign-in: Google only accepts https redirect URIs (or `localhost`), so it keeps token login. At home, setting the same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` works only when the instance is reached over https (or on `localhost`) and that address is an authorized redirect URI.

## Production deploy

`apps/server/wrangler.jsonc` has an `env.production` section: the Worker `metrack`, the D1 database `metrack`, the R2 bucket `metrack-images`, the same binding names as the test Worker (`DB`, `IMAGES`, `ASSETS`), `workers_dev` and `preview_urls` off, and `TMDB_LANGUAGE`. It has no `routes`: the custom domain is attached to the Worker in the dashboard and a deploy without `routes` keeps it. Bindings and `vars` are not inherited by an environment, so they are repeated there; the top level stays the test Worker. Check the result without touching Cloudflare with `npx wrangler deploy --dry-run --env production --outdir /tmp/out`.

A tag `vX.Y.Z` on main runs the `deploy` job of `.github/workflows/ci.yml` after `check` passes and the owner approves the `cloudflare` environment:

1. Records the D1 Time Travel bookmark and the Worker version currently live in the job summary, with the exact rollback commands.
2. `wrangler d1 migrations apply metrack --remote --env production`. In CI wrangler skips the confirmation prompt and applies.
3. `wrangler deploy --env production --var APP_VERSION:<tag>`.
4. Calls `<METRACK_URL>/api/health` up to six times and fails unless it answers 200 with `appVersion` equal to the tag. Bot Fight Mode on the zone challenges requests from datacenter IPs such as GitHub's runners (it cannot be skipped per host on the free plan), so when the response carries `cf-mitigated` or is a 403 with an `error code: 10xx` body the job asks the Cloudflare API instead: it passes with a warning when a single version serves all traffic with `APP_VERSION` equal to the tag, and fails otherwise. Open the health URL in a browser after such a deploy.

The job never exports the database or uploads data as an artifact.

### One-time setup in Cloudflare

```sh
cd apps/server
npx wrangler login
npx wrangler d1 create metrack               # put the printed database_id in env.production
npx wrangler r2 bucket create metrack-images
npx wrangler d1 migrations apply metrack --remote --env production
npx wrangler deploy --env production
npx wrangler secret put TMDB_API_KEY --env production   # likewise IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, STEAMGRIDDB_TOKEN, STEAM_API_KEY
```

Provider keys are Worker secrets set by hand, never by CI. Then attach the custom domain (for example `metrack.example.org`) to the Worker in the dashboard (Workers & Pages, the Worker, Settings, Domains & Routes). Add a Configuration Rule for that host only that turns off Email Obfuscation, Automatic HTTPS Rewrites and Rocket Loader, so the HTML keeps its `ETag`.

### GitHub setup

- Environment `cloudflare` with a required reviewer and a deployment tag rule `v*`.
- Secret `CLOUDFLARE_API_TOKEN` (in that environment).
- Variables `CLOUDFLARE_ACCOUNT_ID` and `METRACK_URL` (the public address of the Worker, without a trailing slash).

### API token

Create an account-owned or user API token with Account permissions Workers Scripts: Edit and D1: Edit, and no zone permissions. D1 Edit applies to every D1 database of the account, not only `metrack`.

### Rolling back

- Code: `npx wrangler rollback <version-id> --env production`, with the version id from the deploy's job summary (or `npx wrangler versions list --env production`).
- Data: `npx wrangler d1 time-travel restore metrack --bookmark <bookmark> --env production`, with the bookmark from the job summary. It overwrites everything written since the bookmark and cancels in-flight queries, and the history is kept for 7 days on the free plan. Migrations should therefore be additive, so that the previous code keeps working on the new schema and only a code rollback is needed.

### Rate limiting the sign-in and invitation routes

The Worker has no rate limit of its own. A Cloudflare Rate Limiting rule on the zone of the custom domain covers the routes that accept a secret or an invitation code. The free plan allows one rule, matching on the path only, counting by IP, with a 10 second period and a 10 second block, so the values below are the most the plan offers. Create it in the dashboard (the zone, Security, WAF, Rate limiting rules):

| Setting                       | Value                                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule name                     | `metrack sign-in and invitations`                                                                                                                                                        |
| Expression (Edit expression)  | `(http.request.uri.path in {"/api/auth/token-login" "/api/auth/dev-login" "/api/auth/google/start" "/api/auth/google/callback"}) or starts_with(http.request.uri.path, "/api/invites/")` |
| With the same characteristics | IP                                                                                                                                                                                       |
| When rate exceeds             | 8 requests per 10 seconds                                                                                                                                                                |
| Then take action              | Block, default response (429)                                                                                                                                                            |
| For duration                  | 10 seconds                                                                                                                                                                               |

`/api/auth/me` and `/api/auth/logout` stay out: the app calls `/api/auth/me` on every load. `/api/invites/` with the trailing slash catches the public `GET /api/invites/{code}` and the owner's `DELETE /api/invites/{id}`, not the owner's list (`GET /api/invites`). Joining through an invitation takes about four requests (preview, Google start and callback, sometimes a reload), so 8 leaves room for a person and caps a script at about 8 tries every 20 seconds. The rule only sees traffic through the custom domain; the production Worker has `workers_dev` off, so there is no other way in. Check it from a shell outside Cloudflare's bot challenge (Bot Fight Mode answers 403 to datacenter IPs before the rule counts):

```sh
for i in $(seq 1 12); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' \
    -d '{"token":"x"}' "$METRACK_URL/api/auth/token-login"
done
```

The first 8 answer 401 and the rest 429 until 10 seconds after the last blocked one.

## What the cloud does not do yet

- Sign in: only personal API tokens work on a deployed Worker, either as `Authorization: Bearer` or through the web token sign-in form (`POST /api/auth/token-login`). Google login is pending.
- Jellyfin and Jellystat sync (`/api/sync/*` answer 501), the Jellyfin webhook included.
- The vault mirror.
- The account export ZIP (`GET /api/account/export` does not exist: building it costs CPU and memory in proportion to the image bytes, far over the free plan's 10 ms and 128 MB). The web app builds the ZIP in the browser from `GET /api/account/export/data` and one `GET /api/images/{hash}` per image; the data route skips the R2 lookup per image, so an image row whose file is missing is only discovered when the browser fails to fetch it.
- Backups (`/api/backups` does not exist; `GET /api/health` reports `features.backups: false`, so Settings hides the section) and the archive of images.
- Release alerts and ntfy notifications: there is no timer. The Worker only stores each user's ntfy topic and never publishes to ntfy. Users turn alerts on in Settings (`POST /api/settings/ntfy-topic`), which makes the server generate a random topic, regenerate it, or turn alerts off (`DELETE`); the owner cannot type a topic for anyone (`PATCH /api/users/{id}/settings` refuses `ntfyTopic`). Sending the alerts is the job of the home connector, from the home IP.
- Erasing deleted accounts: a deletion can be scheduled, but nothing runs the job that carries it out after the grace period.
- Server-side image recoding: uploads must already be WebP.
