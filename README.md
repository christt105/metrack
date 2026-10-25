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

## Dependencies

- `node:sqlite` (built into Node 22): avoids a native module and a build toolchain in the image; it is still marked experimental, so it is confined to `apps/server/src/storage` and the image silences its warning.
- `fastify` and `@fastify/static`: routing, in-process request injection for tests and static file serving with little code.
- `vue`, `vite`, `@vitejs/plugin-vue`, `vue-tsc`: the frontend.
- `vitest`, `eslint`, `prettier`, `typescript`, `tsx`: tests, lint, formatting, type checking and dev reload.

## Migrations

Migrations are TypeScript modules in `apps/server/src/storage/migrations`, numbered contiguously from 1 and registered in `index.ts`. They run in order at startup, each in its own transaction, and are recorded in `schema_migrations`.

## Backups

The server writes a backup every `BACKUP_INTERVAL_HOURS` (default 24) to `/data/backups`, keeping the newest `BACKUP_RETENTION` (default 14). A check runs at startup and every 10 minutes, and a backup is taken when the newest one is older than the interval, so a restart after downtime catches up. Set `BACKUP_ENABLED=false` to turn the scheduler off.

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
docker exec metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js list
docker exec metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js create
```

### Restore

Stop the service first, since the database file is replaced. Then run the restore in a one-off container (the name comes from `list`) and start the service again. The backup is re-verified before anything is overwritten, and the image store is replaced by the one in the backup.

```sh
docker compose stop metrack
docker compose run --rm metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js restore metrack-20261024T031500000Z
docker compose start metrack
```

A test restores a backup over a modified database and image store and checks the result matches the original.

### Off-server copy

The service does not copy backups off the machine. Run something on the host against the bind-mounted `${METRACK_DATA}/backups` directory, for example a daily cron job:

```sh
rsync -a --delete /path/to/metrack-data/backups/ backup-host:/srv/backups/metrack/
rclone sync /path/to/metrack-data/backups remote:metrack-backups
```

Backups are immutable directories, so syncing the whole folder is safe. Restore from an off-server copy by placing the backup directory back under `backups/` and running the restore above.
