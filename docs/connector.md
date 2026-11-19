# Home connector

The Cloudflare Worker cannot reach Jellyfin or Jellystat, which live on the home network. The connector is the same image as the home server, started in another mode (`connector`), with no metrack database of its own. It reads Jellyfin and Jellystat, reads each user's state from the cloud, computes the sync plan at home with the same planner the server uses, and sends only the changes. The cloud checks that every id in the plan belongs to the user, reading only the titles the plan names, writes it and fetches provider metadata for the titles it created. The sync rules (what counts as watched, how seasons are paired) are those described in the README. Episodes are synced one by one and by episode: the state the connector reads carries the user's watched episodes of each series (`watches`, one extra row per series that has them) and the plan carries, for each series whose watches change, the full merged list (`watches` of the series, keyed by TMDB episode id, or `s<season>e<episode>` without one, one viewing per day watched) and, for each season, its status, dates, `watchedEpisodes` and its rewatches when they change. The plan's list already holds the stored viewings, so the cloud replaces the viewings of the episodes the plan carries and keeps the others, and episodes marked by hand survive; the only viewing a plan drops is an unknown-date first viewing that a dated one replaces. Before planning, the connector asks TMDB (`TMDB_API_KEY`) for the TMDB id of each watched episode's TheTVDB id and for the series' ordering (the stored episode group, or the regular seasons), and the plan then records the viewings in the seasons of that ordering. The answers to `/find` are kept in `tvdb-episode-ids.json` in the connector's data directory. Each watched episode is matched by the TMDB id Jellyfin gives it (when the ordering has it, with no `/find` request), then by its TheTVDB id, then by a unique air date, and last by position when the counts agree exactly. Episodes it cannot match and episodes without a number are not recorded and appear as the `episode_unmatched` and `episode_without_number` warnings. The unmatched episodes and the ones TMDB places in another series are also sent as the series' `unmatched` list (season, number, name, code and the other TMDB series), which the cloud stores per user and series, replaces on each sync of the series and shows as a banner on the series and season pages; a plan without `unmatched`, such as one from v0.21.0, leaves the stored list as it is. This needs the release after v0.20.0; a v0.20.0 connector keeps working, it just sends no episodes and no `watchedEpisodes`, and the cloud then only keeps the season's `watched_count` right when it completes a season.

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
      # CLOUD_BACKUP_D1_DATABASE_ID: ${CLOUD_BACKUP_D1_DATABASE_ID}
      # CLOUD_BACKUP_D1_TOKEN: ${CLOUD_BACKUP_D1_TOKEN}
      # CLOUD_BACKUP_R2_BUCKET: metrack-images
      # CLOUD_BACKUP_R2_ACCESS_KEY_ID: ${CLOUD_BACKUP_R2_ACCESS_KEY_ID}
      # CLOUD_BACKUP_R2_SECRET_ACCESS_KEY: ${CLOUD_BACKUP_R2_SECRET_ACCESS_KEY}
      # Optional Cloudflare usage alerts, section 10 (also needs NTFY_URL and NTFY_TOPIC):
      # CLOUDFLARE_ACCOUNT_ID: ${CLOUDFLARE_ACCOUNT_ID}
      # CLOUDFLARE_USAGE_TOKEN: ${CLOUDFLARE_USAGE_TOKEN}
      # Optional daily deletion of orphan images in the cloud, section 9 (needs an R2 key that may delete):
      # CLOUD_IMAGE_CLEANUP: 'true'
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

| Variable                                                                                   | Default                                      | Meaning                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `METRACK_URL`                                                                              | required                                     | Address of the metrack to sync into                                                                                                                                                                                         |
| `METRACK_CONNECTOR_TOKEN`                                                                  | required                                     | The `connector` token (or a personal `write` token)                                                                                                                                                                         |
| `JELLYFIN_URL`, `JELLYFIN_TOKEN`                                                           | required                                     | Jellyfin address and an API key                                                                                                                                                                                             |
| `JELLYSTAT_DB_HOST`, `JELLYSTAT_DB_PASSWORD`                                               | required                                     | Jellystat Postgres host and password                                                                                                                                                                                        |
| `JELLYSTAT_DB_PORT`, `JELLYSTAT_DB_USER`, `JELLYSTAT_DB_NAME`                              | 5432, postgres, jellystat                    | Rest of the connection                                                                                                                                                                                                      |
| `SYNC_WEBHOOK_SECRET`                                                                      | unset                                        | Secret the webhook must send (16+ characters), as `X-Webhook-Secret` or `?token=`                                                                                                                                           |
| `SYNC_WEBHOOK_DELAY_SECONDS`                                                               | 120                                          | Quiet time after a webhook before a user's sync runs, so Jellystat has recorded the play                                                                                                                                    |
| `CONNECTOR_PASS_HOURS`                                                                     | 6                                            | Hours between full passes over every user, in case a webhook was lost                                                                                                                                                       |
| `CONNECTOR_DATA_DIR`                                                                       | `DATA_DIR` (`/data`)                         | Where the connector keeps its state (`connector-state.json`: pending users)                                                                                                                                                 |
| `SYNC_COMPANION_ACCOUNTS`                                                                  | unset (off)                                  | Comma separated Jellyfin user names (`laia`) whose playback may date an episode or movie the user marked as played without playing it, section 5. Applies to every user except the one named; empty leaves such items alone |
| `SYNC_TIME_ZONE`                                                                           | `Europe/Madrid`                              | Time zone that decides on which day a viewing falls                                                                                                                                                                         |
| `TMDB_API_KEY`, `TMDB_LANGUAGE`                                                            | unset, `es-ES`                               | Optional: pairs series Jellyfin only knows by TheTVDB id (the cloud fetches the metadata) and records watched episodes by TMDB episode id                                                                                   |
| `NTFY_URL`, `NTFY_TOPIC`, `NTFY_TOKEN`                                                     | unset                                        | Where the connector reports a run of failures                                                                                                                                                                               |
| `CONNECTOR_RELEASE_ALERTS`                                                                 | unset (off)                                  | `true` turns on the release alerts of section 7                                                                                                                                                                             |
| `CONNECTOR_RELEASE_NTFY_URL`                                                               | `https://ntfy.sh`                            | Server the users' topics live on (no token), separate from `NTFY_URL`                                                                                                                                                       |
| `CONNECTOR_RELEASE_FROM_HOUR`                                                              | 9                                            | Madrid hour before which nothing is checked or sent                                                                                                                                                                         |
| `CONNECTOR_RELEASE_TICK_MINUTES`                                                           | 5                                            | Minutes between looks at which titles are due                                                                                                                                                                               |
| `CONNECTOR_RELEASE_DAILY_LIMIT`                                                            | 200                                          | Alerts sent per UTC day before stopping, to stay under ntfy.sh's 250 per IP                                                                                                                                                 |
| `CLOUD_BACKUP_DIR`                                                                         | unset (off)                                  | Folder for the daily copy of the cloud data (section 8); the copy needs this and the next three                                                                                                                             |
| `CLOUDFLARE_ACCOUNT_ID`                                                                    | unset                                        | Cloudflare account of the D1 database, the R2 bucket and the usage alerts                                                                                                                                                   |
| `CLOUDFLARE_USAGE_TOKEN`                                                                   | unset (off)                                  | API token with `Account Analytics: Read`; turns on the Cloudflare usage alerts (section 10) together with `CLOUDFLARE_ACCOUNT_ID`, `NTFY_URL` and `NTFY_TOPIC`                                                              |
| `CLOUDFLARE_USAGE_WARN_PERCENT`, `CLOUDFLARE_USAGE_CRITICAL_PERCENT`                       | 70, 90                                       | Share of a free-plan limit that sends a normal and an urgent alert; `CLOUDFLARE_LIMIT_*` override the limits as in the README                                                                                               |
| `CLOUD_BACKUP_D1_DATABASE_ID`, `CLOUD_BACKUP_D1_TOKEN`                                     | unset                                        | D1 database to copy and an API token with D1 Edit (the export endpoint requires it)                                                                                                                                         |
| `CLOUD_BACKUP_R2_BUCKET`                                                                   | unset                                        | R2 bucket whose images are copied; unset copies only the database                                                                                                                                                           |
| `CLOUD_BACKUP_R2_ACCESS_KEY_ID`, `CLOUD_BACKUP_R2_SECRET_ACCESS_KEY`                       | unset                                        | S3 credentials of the bucket (read access is enough); required with the bucket                                                                                                                                              |
| `CLOUD_BACKUP_R2_ENDPOINT`                                                                 | `https://<account>.r2.cloudflarestorage.com` | S3 endpoint, to point the copy at another S3 server                                                                                                                                                                         |
| `CLOUD_BACKUP_RETENTION`                                                                   | 14                                           | Copied databases to keep                                                                                                                                                                                                    |
| `CLOUD_BACKUP_TIME`                                                                        | `04:30`                                      | Time of the daily copy, in the container's time zone (`TZ`)                                                                                                                                                                 |
| `CLOUD_IMAGE_CLEANUP`, `CLOUD_IMAGE_CLEANUP_MAX_FRACTION`, `CLOUD_IMAGE_CLEANUP_MAX_COUNT` | unset (off), `0.5`, `1000`                   | Turns on the daily deletion of orphan images in the cloud (section 9) and sets the most it may delete in one run: a share of all the images and a count                                                                     |
| `PORT`, `HOST`                                                                             | 8097, `0.0.0.0`                              | Where the webhook listens                                                                                                                                                                                                   |

## 4. Jellyfin webhook

In Jellyfin, install the Webhook plugin and add a Generic destination: URL `http://<host address>:8099/webhook`, a JSON body such as `{"event": "{{NotificationType}}"}`, the header `Content-Type: application/json`, the notification types Playback Stop and User Data Saved, and no user filter (the connector syncs everyone with a Jellyfin account). Send the secret in an `X-Webhook-Secret` header (another header in the same destination), or as `?token=<secret>` in the URL if the sender cannot set headers. The body is ignored: a request queues a sync for every user the connector knows. The first notice of a burst (one arriving more than `SYNC_WEBHOOK_DELAY_SECONDS` after the previous one) re-reads the users from the cloud, so an account linked since the last pass is picked up without restarting; the rest of the burst reuses them, and the log has one `Webhook burst queued N users` line per burst.

## 5. How it behaves

- A webhook marks every user pending. Each user's sync starts after `SYNC_WEBHOOK_DELAY_SECONDS` of quiet; a burst of webhooks is one run, and a webhook during a run triggers another afterwards.
- A sync reads Jellyfin and Jellystat, reads the user's state and content version from the cloud, computes the plan, and posts it with that version. If the cloud answers 409 (the library changed meanwhile) it reads the state again and recomputes, up to three plans per attempt. A plan with no changes sends nothing. Then, even when there was nothing to write, it asks the cloud to fetch the provider metadata of every title the plan created and of every title the state lists as never fetched (`unfetched`: movies and series with a TMDB id and no metadata yet), one request per title. So a title whose fetch failed, or that a sync cut short created, gets its metadata on a later sync; a title the provider keeps failing costs one request per sync until it works.
- If the cloud is unreachable or answers an error, or Jellyfin or Jellystat fail, the user stays pending and is retried after 1, 5, 15 and then every 60 minutes, recomputing the plan each time (no plan is stored). After three failures in a row the connector notifies through ntfy, and once more when it works again. Pending users survive a restart, in `connector-state.json`.
- Every `CONNECTOR_PASS_HOURS` hours (and at start) it asks the cloud who has a Jellyfin account and queues all of them.
- Items marked as played by hand: Jellystat only records real playback, so an episode or movie the user marked as played in Jellyfin without playing it has no playback of their own. With `SYNC_COMPANION_ACCOUNTS` set, such an item gets the latest day on which one of those accounts played it completely (90 % of its runtime within that day) in the 7 days up to and including the day of the mark (`LastPlayedDate` of the user's Jellyfin data); if there is none, an episode counts as watched with no date, like any viewing the user marked in metrack without a date, and a movie is left alone because a movie needs a date to be completed. An item with any playback of the user's own is never affected. The window and the 90 % are constants (`COMPANION_WINDOW_DAYS`, `WATCHED_FRACTION`). Passes are idempotent: an existing viewing, dated or not, is never duplicated or overwritten by this, and an undated one is not turned into a rewatch. `connector report --verbose` prints how many items were dated from a companion and how many stayed undated.
- Ratings, reviews, notes and images are never sent or touched; the cloud only accepts tracking fields and external ids.

## 6. Command line

```sh
docker exec metrack-connector node --disable-warning=ExperimentalWarning apps/server/dist/cli.js connector report --user <id|name|jellyfinUser> --verbose
docker exec metrack-connector node --disable-warning=ExperimentalWarning apps/server/dist/cli.js connector sync --user <id|name|jellyfinUser>
```

`metrack connector` with no subcommand is the long-lived service. `connector cloud-backup`, `connector restore-sql` and `connector row-counts` belong to the cloud copy (section 8) and `connector cloud-image-cleanup` to the image cleanup (section 9). `connector report` prints the plan for one user and writes nothing, like `metrack sync` does at home. `connector sync` computes and applies the plan for one user once and exits, the same path a webhook takes (re-planning on a 409, then refreshing the created titles and the ones without metadata), and prints the result; `report` also says how many titles have no metadata yet. `--user` takes the user's id, name or Jellyfin account. Both need the same environment variables as the service.

## 7. Release alerts

With `CONNECTOR_RELEASE_ALERTS=true` (and `TMDB_API_KEY`) the connector also checks the followed movies and series of every cloud user with an ntfy topic and sends them their release alerts, so the Worker does no TMDB work. It is off by default: while the home server (`ALERTS_ENABLED`) still sends alerts to the same topics, leave it off so no topic gets two. A user must be given an ntfy topic in their settings; the connector's own `NTFY_*` is only for its failure reports.

- The same logic as the home server's: each title is looked at at an interval that depends on how close its release is, TMDB is asked from home, the announced seasons are created in the cloud and the next announced episode of each series is stored with them (`POST /api/connector/users/{id}/seasons`; the optional `release.nextEpisode.name` can be omitted by a connector of an older version) and each alert is sent once. Alerts use Europe/Madrid for everyone and nothing is checked or sent before `CONNECTOR_RELEASE_FROM_HOUR` (9).
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

## 9. Orphan image cleanup in the cloud

The Worker does not delete images when it erases an account (its cron only erases the account's rows, because deleting images there costs more CPU and Cloudflare calls than the free plan allows), and nothing else in the cloud removes the covers that no title uses any more. The connector does it, directly against Cloudflare and not through the Worker. It is off unless `CLOUD_IMAGE_CLEANUP=true`, and it needs the cloud backup settings of section 8 with the R2 bucket (the connector refuses to start otherwise).

- **What it deletes:** the images `ImageStore.orphans` reports with the 24 hour grace period: no cover, banner or review points at them, they are not the archived copy of a linked provider URL, and nobody claimed them in the last 24 hours. It is the same code the Worker's cleanup route uses, run over two adapters: D1 through the REST API (`POST /accounts/{account}/d1/database/{database}/query`; a `batch` is sent as one request with a `batch` array, which D1 runs in order in one transaction, and a request over 90 KB is refused rather than split) with the same `CLOUD_BACKUP_D1_TOKEN`, and R2 through the S3 API with the same `CLOUD_BACKUP_R2_*` key.
- **Credential:** the S3 key of the backup can be read-only, but the cleanup needs one that may delete objects in the bucket, so replace it with an Object Read and Write key for that bucket before turning the cleanup on. With it a bug at home could delete production images; the daily copy of section 8 is what protects against that.
- **Order:** each image is deleted like `ImageStore.delete` does, the rows first and then the object. If the object cannot be deleted after its row is gone, it is logged and the run goes on (a leftover object is harmless); such a run counts as a failure.
- **Schedule:** it runs right after the cloud backup of the day (`CLOUD_BACKUP_TIME`) succeeds, so that day's copy still has the images it deletes. When the backup fails and is retried, the cleanup waits for the retry to succeed. A failed cleanup is not retried before the next day. After three failures in a row the connector notifies through ntfy, and once more when it works again.
- **Safety limit:** a run that finds more than `CLOUD_IMAGE_CLEANUP_MAX_COUNT` orphans (1000), or more than `CLOUD_IMAGE_CLEANUP_MAX_FRACTION` of all the images (0.5), deletes nothing and fails, so a wrong orphan query cannot empty the bucket. Raise the limits for a first run that has to clear a large backlog (for example the covers archived before the cleanup existed).
- **One run now:** `docker exec metrack-connector node --disable-warning=ExperimentalWarning apps/server/dist/cli.js connector cloud-image-cleanup` lists how many images are orphaned and their size and deletes nothing; add `--apply` to delete them. It does not need `CLOUD_IMAGE_CLEANUP` to be set.

## 10. Cloudflare usage alerts

The connector checks the Cloudflare account usage every 15 minutes, the first time at startup, and sends an ntfy alert to its own owner target (`NTFY_URL`, `NTFY_TOPIC`, `NTFY_TOKEN`, the same one as its failure alerts) when a free-plan quota gets close to its limit. It is off unless `CLOUDFLARE_USAGE_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set; without ntfy it logs that it is off. The token needs only `Account Analytics: Read`. The metrics, thresholds (`CLOUDFLARE_USAGE_WARN_PERCENT`, `CLOUDFLARE_USAGE_CRITICAL_PERCENT`), limits (`CLOUDFLARE_LIMIT_*`) and alert behavior are the ones described under "Cloudflare usage alerts" in the README. What was already announced is kept in `cloudflare-usage-state.json` in `CONNECTOR_DATA_DIR`, so a restart does not repeat alerts. The startup log has one `cloudflare usage alerts on` line with the thresholds.

The connector protocol keeps `rewatches` as a list of finish dates (strings): the sync state the cloud serves carries only the finish dates of closed viewings, and the plan the connector sends carries dates too (viewing objects are also accepted). When the cloud applies a movie change it merges: stored viewings keep their starts and an open viewing stays, and a closed viewing is added for each date not already present. Connectors from before viewings existed keep working unchanged.
