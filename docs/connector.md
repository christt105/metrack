# Home connector

The Cloudflare Worker cannot reach Jellyfin or Jellystat, which live on the home network. The connector is the same image as the home server, started in another mode (`connector`), with no metrack database of its own. It reads Jellyfin and Jellystat, reads each user's state from the cloud, computes the sync plan at home with the same planner the server uses, and sends only the changes. The cloud checks that every id in the plan belongs to the user, reading only the titles the plan names, writes it and fetches provider metadata for the titles it created. The sync rules (what counts as watched, how seasons are paired) are those described in the README.

The connector also works against a home server (`METRACK_URL=http://metrack:8097`), which is how to try it without a Worker.

## 1. Create the token

Open the web app of the metrack the connector syncs into, sign in as the owner (user 1), go to Settings, Access tokens, pick the scope "Home connector" and create it. Copy the secret, it is shown once. A `connector` token acts on every user who has a Jellyfin account in their settings (the owner sets it under Settings, Users, or with `metrack users set <id> --jellyfin-user <name>`), and works only on `/api/connector/*`: on any other route it answers 403, so it cannot read or edit anyone's library, settings or tokens.

Someone who runs their own Jellyfin can instead create a personal token with the scope "Read and write" and run their own connector with it: it syncs only their own account, which the owner must have set as their Jellyfin account.

## 2. Compose service

```yaml
services:
  metrack-connector:
    image: ghcr.io/christt105/metrack:${METRACK_TAG}
    command: connector
    container_name: metrack-connector
    restart: unless-stopped
    ports:
      - '8099:8097'
    environment:
      METRACK_URL: https://metrack.example.workers.dev
      METRACK_CONNECTOR_TOKEN: ${METRACK_CONNECTOR_TOKEN}
      JELLYFIN_URL: http://192.168.1.15:8096
      JELLYFIN_TOKEN: ${JELLYFIN_TOKEN}
      JELLYSTAT_DB_HOST: jellystat-db
      JELLYSTAT_DB_PASSWORD: ${JELLYSTAT_DB_PASSWORD}
      SYNC_WEBHOOK_SECRET: ${SYNC_WEBHOOK_SECRET}
      TZ: Europe/Madrid
      # Optional daily copy of the cloud data, section 8:
      # CLOUD_BACKUP_DIR: /cloud-backup
      # CLOUDFLARE_ACCOUNT_ID: ${CLOUDFLARE_ACCOUNT_ID}
      # CLOUD_BACKUP_D1_DATABASE_ID: ${CLOUD_BACKUP_D1_DATABASE_ID}
      # CLOUD_BACKUP_D1_TOKEN: ${CLOUD_BACKUP_D1_TOKEN}
      # CLOUD_BACKUP_R2_BUCKET: metrack-images
      # CLOUD_BACKUP_R2_ACCESS_KEY_ID: ${CLOUD_BACKUP_R2_ACCESS_KEY_ID}
      # CLOUD_BACKUP_R2_SECRET_ACCESS_KEY: ${CLOUD_BACKUP_R2_SECRET_ACCESS_KEY}
    volumes:
      - ./connector-data:/data
      # - /path/to/backups/metrack-cloud:/cloud-backup
    networks:
      - default
      - jellystat

networks:
  jellystat:
    external: true
    name: jellystat_default
```

The service joins the Jellystat network to reach its Postgres by container name. Jellyfin runs in host network, so the webhook cannot reach the container by name: publish a port on the host (`8099` above) and point the Jellyfin plugin at `http://<host address>:8099/webhook`. With `command: connector` the image's entrypoint starts `metrack connector`, which serves `POST /webhook` and `GET /api/health` on `PORT` (8097) and syncs on its own.

## 3. Environment variables

| Variable                                                             | Default                                      | Meaning                                                                                         |
| -------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `METRACK_URL`                                                        | required                                     | Address of the metrack to sync into                                                             |
| `METRACK_CONNECTOR_TOKEN`                                            | required                                     | The `connector` token (or a personal `write` token)                                             |
| `JELLYFIN_URL`, `JELLYFIN_TOKEN`                                     | required                                     | Jellyfin address and an API key                                                                 |
| `JELLYSTAT_DB_HOST`, `JELLYSTAT_DB_PASSWORD`                         | required                                     | Jellystat Postgres host and password                                                            |
| `JELLYSTAT_DB_PORT`, `JELLYSTAT_DB_USER`, `JELLYSTAT_DB_NAME`        | 5432, postgres, jellystat                    | Rest of the connection                                                                          |
| `SYNC_WEBHOOK_SECRET`                                                | unset                                        | Secret the webhook must send (16+ characters), as `X-Webhook-Secret` or `?token=`               |
| `SYNC_WEBHOOK_DELAY_SECONDS`                                         | 120                                          | Quiet time after a webhook before a user's sync runs, so Jellystat has recorded the play        |
| `CONNECTOR_PASS_HOURS`                                               | 6                                            | Hours between full passes over every user, in case a webhook was lost                           |
| `CONNECTOR_DATA_DIR`                                                 | `DATA_DIR` (`/data`)                         | Where the connector keeps its state (`connector-state.json`: pending users)                     |
| `SYNC_TIME_ZONE`                                                     | `Europe/Madrid`                              | Time zone that decides on which day a viewing falls                                             |
| `TMDB_API_KEY`, `TMDB_LANGUAGE`                                      | unset, `es-ES`                               | Optional: pairs series Jellyfin only knows by TheTVDB id (the cloud fetches the metadata)       |
| `NTFY_URL`, `NTFY_TOPIC`, `NTFY_TOKEN`                               | unset                                        | Where the connector reports a run of failures                                                   |
| `CONNECTOR_RELEASE_ALERTS`                                           | unset (off)                                  | `true` turns on the release alerts of section 7                                                 |
| `CONNECTOR_RELEASE_NTFY_URL`                                         | `https://ntfy.sh`                            | Server the users' topics live on (no token), separate from `NTFY_URL`                           |
| `CONNECTOR_RELEASE_FROM_HOUR`                                        | 9                                            | Madrid hour before which nothing is checked or sent                                             |
| `CONNECTOR_RELEASE_TICK_MINUTES`                                     | 5                                            | Minutes between looks at which titles are due                                                   |
| `CONNECTOR_RELEASE_DAILY_LIMIT`                                      | 200                                          | Alerts sent per UTC day before stopping, to stay under ntfy.sh's 250 per IP                     |
| `CLOUD_BACKUP_DIR`                                                   | unset (off)                                  | Folder for the daily copy of the cloud data (section 8); the copy needs this and the next three |
| `CLOUDFLARE_ACCOUNT_ID`                                              | unset                                        | Cloudflare account of the D1 database and the R2 bucket                                         |
| `CLOUD_BACKUP_D1_DATABASE_ID`, `CLOUD_BACKUP_D1_TOKEN`               | unset                                        | D1 database to copy and an API token with D1 Edit (the export endpoint requires it)             |
| `CLOUD_BACKUP_R2_BUCKET`                                             | unset                                        | R2 bucket whose images are copied; unset copies only the database                               |
| `CLOUD_BACKUP_R2_ACCESS_KEY_ID`, `CLOUD_BACKUP_R2_SECRET_ACCESS_KEY` | unset                                        | S3 credentials of the bucket (read access is enough); required with the bucket                  |
| `CLOUD_BACKUP_R2_ENDPOINT`                                           | `https://<account>.r2.cloudflarestorage.com` | S3 endpoint, to point the copy at another S3 server                                             |
| `CLOUD_BACKUP_RETENTION`                                             | 14                                           | Copied databases to keep                                                                        |
| `CLOUD_BACKUP_TIME`                                                  | `04:30`                                      | Time of the daily copy, in the container's time zone (`TZ`)                                     |
| `PORT`, `HOST`                                                       | 8097, `0.0.0.0`                              | Where the webhook listens                                                                       |

## 4. Jellyfin webhook

In Jellyfin, install the Webhook plugin and add a Generic destination: URL `http://<host address>:8099/webhook`, a JSON body such as `{"event": "{{NotificationType}}"}`, the header `Content-Type: application/json`, the notification types Playback Stop and User Data Saved, and no user filter (the connector syncs everyone with a Jellyfin account). Send the secret in an `X-Webhook-Secret` header (another header in the same destination), or as `?token=<secret>` in the URL if the sender cannot set headers. The body is ignored: a request queues a sync for every user the connector knew at its last pass.

## 5. How it behaves

- A webhook marks every user pending. Each user's sync starts after `SYNC_WEBHOOK_DELAY_SECONDS` of quiet; a burst of webhooks is one run, and a webhook during a run triggers another afterwards.
- A sync reads Jellyfin and Jellystat, reads the user's state and content version from the cloud, computes the plan, and posts it with that version. If the cloud answers 409 (the library changed meanwhile) it reads the state again and recomputes, up to three plans per attempt. A plan with no changes sends nothing. Then, even when there was nothing to write, it asks the cloud to fetch the provider metadata of every title the plan created and of every title the state lists as never fetched (`unfetched`: movies and series with a TMDB id and no metadata yet), one request per title. So a title whose fetch failed, or that a sync cut short created, gets its metadata on a later sync; a title the provider keeps failing costs one request per sync until it works.
- If the cloud is unreachable or answers an error, or Jellyfin or Jellystat fail, the user stays pending and is retried after 1, 5, 15 and then every 60 minutes, recomputing the plan each time (no plan is stored). After three failures in a row the connector notifies through ntfy, and once more when it works again. Pending users survive a restart, in `connector-state.json`.
- Every `CONNECTOR_PASS_HOURS` hours (and at start) it asks the cloud who has a Jellyfin account and queues all of them.
- Ratings, reviews, notes and images are never sent or touched; the cloud only accepts tracking fields and external ids.

## 6. Command line

```sh
docker exec metrack-connector node --disable-warning=ExperimentalWarning apps/server/dist/cli.js connector report --user <id|name|jellyfinUser> --verbose
docker exec metrack-connector node --disable-warning=ExperimentalWarning apps/server/dist/cli.js connector sync --user <id|name|jellyfinUser>
```

`metrack connector` with no subcommand is the long-lived service. `connector cloud-backup`, `connector restore-sql` and `connector row-counts` belong to the cloud copy (section 8). `connector report` prints the plan for one user and writes nothing, like `metrack sync` does at home. `connector sync` computes and applies the plan for one user once and exits, the same path a webhook takes (re-planning on a 409, then refreshing the created titles and the ones without metadata), and prints the result; `report` also says how many titles have no metadata yet. `--user` takes the user's id, name or Jellyfin account. Both need the same environment variables as the service.

## 7. Release alerts

With `CONNECTOR_RELEASE_ALERTS=true` (and `TMDB_API_KEY`) the connector also checks the followed movies and series of every cloud user with an ntfy topic and sends them their release alerts, so the Worker does no TMDB work. It is off by default: while the home server (`ALERTS_ENABLED`) still sends alerts to the same topics, leave it off so no topic gets two. A user must be given an ntfy topic in their settings; the connector's own `NTFY_*` is only for its failure reports.

- The same logic as the home server's: each title is looked at at an interval that depends on how close its release is, TMDB is asked from home, the announced seasons are created in the cloud (`POST /api/connector/users/{id}/seasons`) and each alert is sent once. Alerts use Europe/Madrid for everyone and nothing is checked or sent before `CONNECTOR_RELEASE_FROM_HOUR` (9).
- Next-check times are kept in memory. The cloud is asked for a user's state (`GET /api/connector/users/{id}/release-state`, one read) only when one of their titles is due, and every six hours to notice new follows and users; a tick with nothing due makes no cloud request. After a restart every title is checked once.
- Each alert is posted to the user's topic on `CONNECTOR_RELEASE_NTFY_URL` and recorded in the cloud (`POST /api/connector/users/{id}/release-alerts`) only after ntfy accepted it. Recorded keys are never sent again, so a restart does not repeat an alert. If the cloud is down when recording, the alert is remembered in memory and recorded later, so it is not resent either; only a restart during that outage would repeat it.
- The alerts sent per UTC day are counted in `connector-state.json`. At `CONNECTOR_RELEASE_DAILY_LIMIT` the connector stops sending, logs it once, and the rest wait for the next day (their titles are checked again after 30 minutes). The default leaves margin under ntfy.sh's limit of 250 anonymous messages a day per IP.

## 8. Daily copy of the cloud data

D1's Time Travel only keeps 7 days and cannot be downloaded, so the connector can copy the cloud data to the home server every day. It is off unless `CLOUD_BACKUP_DIR` and the D1 variables are set; setting only some of them makes the connector refuse to start and name the rest. It uses the layout of the home server's backup copy (`BACKUP_COPY_DIR`): `databases/metrack-<UTC timestamp>.db`, one per run, and one shared `images/` folder.

- **Database:** at `CLOUD_BACKUP_TIME` it asks D1 for its official SQL export (`POST /accounts/{account}/d1/database/{database}/export`, polled until it is ready), loads the SQL into a new SQLite file, runs `PRAGMA integrity_check` and renames it into `databases/`. The export reads the whole database once (about as many rows as it has, against the free plan's 5 million rows read per day) and costs the Worker nothing. The token needs the D1 Edit permission, which Cloudflare scopes to the whole account (every D1 database in it, not just this one), so keep it only in the connector's environment.
- **Images:** it lists the bucket through the S3 API (SigV4 signing is built in, no extra dependency) and downloads only the images the new database lists and the copy does not have; images are stored by hash and never change, so each is downloaded once. R2 credentials come from the R2 API token page (an Object Read only token on the bucket is enough: the access key id is the token id, the secret is the SHA-256 of the token value).
- **Order and retention:** images are written before the database, and every file is written under a partial name and renamed, so a failed run leaves no half file and every copied database has its images. After the run it keeps the newest `CLOUD_BACKUP_RETENTION` databases and removes images no retained database lists; if any retained database cannot be read, no image is removed.
- **Schedule and alerts:** one run a day at `CLOUD_BACKUP_TIME`; when the connector starts and the newest copy is more than a day old, it runs a minute later. A failed run is retried after 1, 5 and 15 minutes and then every hour. After three failures in a row the connector notifies through ntfy (`NTFY_URL`), and once more when it works again. Each run logs the rows, SQL and database sizes, images downloaded and pruned, and the duration.
- **One run now:** `docker exec metrack-connector node --disable-warning=ExperimentalWarning apps/server/dist/cli.js connector cloud-backup`.

The copy does not protect against a mistake that is copied identically during the whole retention, and it copies only the database and bucket the variables name.

### Restoring a copy into D1

`connector restore-sql` turns a copied database into one SQL file that D1 accepts: foreign keys deferred, no transaction or `PRAGMA` D1 refuses, the tables first, then the rows of each table with parents before the tables that reference them (a real D1 import runs in batches, so the deferral alone is not enough), then the indexes and triggers; `d1_migrations` is included so `wrangler d1 migrations apply` still works afterwards. A row whose INSERT would pass D1's 100 KB statement limit is inserted with its large text or blob columns cut, and the rest is appended by `UPDATE ... SET "col" = "col" || ...` statements. `connector row-counts` prints the rows per table, to compare with the restored database.

```sh
CLI="node --disable-warning=ExperimentalWarning apps/server/dist/cli.js connector"
$CLI restore-sql /path/to/databases/metrack-<stamp>.db --out restore.sql
$CLI row-counts /path/to/databases/metrack-<stamp>.db > counts-copy.txt
wrangler d1 create metrack-restore
wrangler d1 execute metrack-restore --remote --yes --file restore.sql
```

The target must be an empty D1 database (the file creates every table); `--yes` skips the confirmation prompt. Check the import by comparing the rows of every table with `counts-copy.txt`. D1 rejects a compound `UNION ALL` of many tables, so count with one row of scalar subqueries:

```sh
wrangler d1 execute metrack-restore --remote --command 'SELECT (SELECT COUNT(*) FROM "movie") AS "movie", (SELECT COUNT(*) FROM "series") AS "series", (SELECT COUNT(*) FROM "user") AS "user"'
```

List every table of `counts-copy.txt` the same way. To restore the images, upload the files of `images/` to the bucket under their own names (`wrangler r2 object put <bucket>/<name> --file images/<name>`).

## What it does not do yet

The Obsidian mirror is a separate task. The web sync page on a Worker says that syncing is done by the connector and shows no report; a report in the web, by uploading the last plan to the cloud, would be a later addition.
