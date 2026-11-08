# metrack

Self-hosted media tracker. TypeScript monorepo (npm workspaces), single Docker container.

## Commands

- `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (all from the repo root; CI runs the same).
- `npm run format` applies prettier.
- `npm run dev:server` (port 8097) and `npm run dev:web` (proxies `/api`).

## Structure

- `packages/domain`: pure logic. No HTTP, no database, no I/O. Built with tsc to `dist`, consumed by the apps.
- `packages/export`: pure exporter from stored data to the Hugo content tree (plus the redirect pages for the old site). No database, no disk; depends on domain and `yaml`.
- `packages/site`: pure renderer of the public pages (`/u/<handle>/`: HTML, RSS, and the Hugo theme's compiled CSS, scripts, font and images under `src/assets`, ported from hugo-mediatracker-theme) from one user's data. No database, no disk, no Node-only APIs; depends on domain and export. The server only loads data for the user in scope and calls it (`apps/server/src/site`).
- `apps/server`: `config/` (env), `storage/` (`repositories/` holds the asynchronous repository interfaces the rest of the server depends on, `sqlite/` their `node:sqlite` implementation, plus migrations), `images/` (image store over an `ImageRepository` and an `ImageBlobStore`, local disk today; TMDB, Steam and IGDB covers are linked and only archived, everything else is re-encoded to WebP by an `ImageEncoder`, and images no provider gave belong to users and count for their quota), `backup/` (scheduled backups, restore), `notify/` (ntfy alerts), `alerts/` (release watcher: follows titles, creates announced seasons, sends each alert once; the policy lives in `packages/domain/src/alerts`), `sync/` (Jellyfin API client, Jellystat reader, applier; the planning rules live in `packages/domain/src/sync`), `auth/` (sessions, the `Authenticator` the API guard asks, and personal API tokens), `users/` (`UserScope`: every personal repository query filters by the user it binds; the guard binds each request, the CLI acts as `OWNER_ID` unless told otherwise; `UserSettings` say what each user's background jobs act on, and `UserQueues`/`UserJobContext` run one queue per enabled user, scheduled as that user), `account/` (export ZIP of one user's data, scheduling and erasing account deletions after 7 days, the hourly job, `ZipArchive`), `api/` (Hono; routes register through `ApiRoutes`, which checks params, query and body against their schemas; every `/api` route needs a session or a token unless it sets `config.public`; `config.ownerOnly` and `config.sessionOnly` routes refuse tokens, `config.trustedOnly` ones refuse normal users), `web/` (the built web app as `StaticFiles`, from disk). Wiring happens only in `src/main.ts`.
- `apps/web`: Vue 3 + Vite; talks to the server only through `src/api`.
- Dependencies point inward: web and server depend on domain and export, export depends on domain, domain depends on nothing.

## Conventions

- English for code, comments, docs, commits and PRs. Conventional Commits.
- One type, class or interface per file.
- No singletons: build instances and inject them (see `buildApp`).
- No comments that narrate changes or reasoning; JSDoc only where genuinely needed.
- Markdown paragraphs are single lines, no hard wrapping.
- A schema change is a new numbered migration, never an edit to an applied one. Versions only need to increase (a number may be left free for another branch); every unrecorded migration runs at start.
- While the home server and Cloudflare D1 coexist, every schema change is a TypeScript migration plus a new SQL migration in `apps/server/d1/migrations` (`0001_schema.sql` is schema 18); `apps/server/test/D1Schema.test.ts` compares both and fails when they diverge.
- Account deletion never has an immediate path: it is scheduled (`user.deletion_requested_at`), waits `ACCOUNT_DELETION_GRACE_DAYS` and is erased by the job; the routes that schedule it are `sessionOnly`, and user 1 is never deleted.
- Port 8097 by default; never 8080, 8090, 8094, 8098, 8053 or 8010.
