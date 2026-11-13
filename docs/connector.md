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
    volumes:
      - ./connector-data:/data
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

| Variable                                                      | Default                   | Meaning                                                                                   |
| ------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `METRACK_URL`                                                 | required                  | Address of the metrack to sync into                                                       |
| `METRACK_CONNECTOR_TOKEN`                                     | required                  | The `connector` token (or a personal `write` token)                                       |
| `JELLYFIN_URL`, `JELLYFIN_TOKEN`                              | required                  | Jellyfin address and an API key                                                           |
| `JELLYSTAT_DB_HOST`, `JELLYSTAT_DB_PASSWORD`                  | required                  | Jellystat Postgres host and password                                                      |
| `JELLYSTAT_DB_PORT`, `JELLYSTAT_DB_USER`, `JELLYSTAT_DB_NAME` | 5432, postgres, jellystat | Rest of the connection                                                                    |
| `SYNC_WEBHOOK_SECRET`                                         | unset                     | Secret the webhook must send (16+ characters), as `X-Webhook-Secret` or `?token=`         |
| `SYNC_WEBHOOK_DELAY_SECONDS`                                  | 120                       | Quiet time after a webhook before a user's sync runs, so Jellystat has recorded the play  |
| `CONNECTOR_PASS_HOURS`                                        | 6                         | Hours between full passes over every user, in case a webhook was lost                     |
| `CONNECTOR_DATA_DIR`                                          | `DATA_DIR` (`/data`)      | Where the connector keeps its state (`connector-state.json`: pending users)               |
| `SYNC_TIME_ZONE`                                              | `Europe/Madrid`           | Time zone that decides on which day a viewing falls                                       |
| `TMDB_API_KEY`, `TMDB_LANGUAGE`                               | unset, `es-ES`            | Optional: pairs series Jellyfin only knows by TheTVDB id (the cloud fetches the metadata) |
| `NTFY_URL`, `NTFY_TOPIC`, `NTFY_TOKEN`                        | unset                     | Where the connector reports a run of failures                                             |
| `PORT`, `HOST`                                                | 8097, `0.0.0.0`           | Where the webhook listens                                                                 |

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

`metrack connector` with no subcommand is the long-lived service. `connector report` prints the plan for one user and writes nothing, like `metrack sync` does at home. `connector sync` computes and applies the plan for one user once and exits, the same path a webhook takes (re-planning on a 409, then refreshing the created titles and the ones without metadata), and prints the result; `report` also says how many titles have no metadata yet. `--user` takes the user's id, name or Jellyfin account. Both need the same environment variables as the service.

## What it does not do yet

Release alerts, the daily export of the database and the Obsidian mirror are separate tasks. The web sync page on a Worker says that syncing is done by the connector and shows no report; a report in the web, by uploading the last plan to the cloud, would be a later addition.
