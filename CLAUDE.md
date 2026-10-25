# metrack

Self-hosted media tracker. TypeScript monorepo (npm workspaces), single Docker container.

## Commands

- `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (all from the repo root; CI runs the same).
- `npm run format` applies prettier.
- `npm run dev:server` (port 8097) and `npm run dev:web` (proxies `/api`).

## Structure

- `packages/domain`: pure logic. No HTTP, no database, no I/O. Built with tsc to `dist`, consumed by the apps.
- `packages/export`: pure exporter from stored data to the Hugo content tree (plus the redirect pages for the old site). No database, no disk; depends on domain and `yaml`.
- `apps/server`: `config/` (env), `storage/` (SQLite via `node:sqlite`, migrations), `backup/` (scheduled backups, restore), `notify/` (ntfy alerts), `alerts/` (release watcher: follows titles, creates announced seasons, sends each alert once; the policy lives in `packages/domain/src/alerts`), `sync/` (Jellyfin API client, Jellystat reader, applier; the planning rules live in `packages/domain/src/sync`), `api/` (Fastify). Wiring happens only in `src/main.ts`.
- `apps/web`: Vue 3 + Vite; talks to the server only through `src/api`.
- Dependencies point inward: web and server depend on domain and export, export depends on domain, domain depends on nothing.

## Conventions

- English for code, comments, docs, commits and PRs. Conventional Commits.
- One type, class or interface per file.
- No singletons: build instances and inject them (see `buildApp`).
- No comments that narrate changes or reasoning; JSDoc only where genuinely needed.
- Markdown paragraphs are single lines, no hard wrapping.
- A schema change is a new numbered migration, never an edit to an applied one.
- Port 8097 by default; never 8080, 8090, 8094, 8098, 8053 or 8010.
