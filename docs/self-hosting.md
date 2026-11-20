# Self-hosting

metrack can run as the cloud version (a Cloudflare Worker with D1 and R2, see [worker.md](worker.md), optionally with the [home connector](connector.md)) or self-hosted: the Node server with SQLite, run with Docker or from source. This page covers the self-hosted server; the topics it has in common with the cloud version are in their own documents, listed in [README.md](README.md).

## Features

- Web app to add and edit titles. Movies and series are searched and refreshed from TMDB, games are searched on IGDB and books on Open Library; anything can also be entered by hand. Artwork comes from TMDB, Steam, IGDB, SteamGridDB and Open Library and is stored locally by content hash.
- Per-season tracking for series: status, dates, rating, review and rewatches.
- Jellyfin viewing sync through Jellystat, with a report-only pass before anything is written.
- Release alerts over ntfy for followed series and movies (premieres and Spanish streaming availability).
- Scheduled, verified backups with retention and a restore command.

## Quick start

```sh
curl -O https://raw.githubusercontent.com/christt105/metrack/main/docker-compose.yml
DEV_LOGIN=true docker compose up -d
curl http://localhost:8097/api/health
```

Then open `http://<host>:8097` and sign in as the owner (see [users.md](users.md)). Every integration is optional and stays off, with a log line naming the missing variables, until it is configured; see the documents listed in [README.md](README.md).

## Docker

Images are published to GitHub Container Registry as `ghcr.io/christt105/metrack` and can be pulled without logging in.

```sh
docker compose pull && docker compose up -d
curl http://localhost:8097/api/health
```

The image tag is set with `METRACK_TAG` (default `latest`), the port with `METRACK_PORT` (default 8097) and the data directory with `METRACK_DATA` (default `./data`, mounted at `/data`). The database lives at `/data/metrack.db`. To run a local build instead, tag it and point `METRACK_TAG` at it:

```sh
docker build -t ghcr.io/christt105/metrack:dev . && METRACK_TAG=dev docker compose up -d
```

### Images and releases

CI runs lint, typecheck, tests and build on every pull request and push to `main`, then builds the image. Every pull request from this repository publishes a preview image, `ghcr.io/christt105/metrack:pr-<number>`, so it can be tried on the server before merging. Pushing a `vX.Y.Z` tag that points at a commit on `main` publishes `vX.Y.Z`, `vX.Y` and `latest`; tags outside `main` fail the release. The image tag is passed as `APP_VERSION` and reported by `/api/health`.

```sh
git tag -a v0.2.0 -m "v0.2.0" && git push origin v0.2.0
```

Images are stored under `/data/images`, named by content hash, and are served at `/api/images/<hash>`. Covers and banners from TMDB, Steam and IGDB are linked to the provider's CDN; the store keeps their original bytes as an archive. Everything else (SteamGridDB, Open Library, uploads, URLs of any site) is re-encoded to WebP without metadata. Uploads (`POST /api/images`, also for images inside reviews) and covers and banners of your own are for the owner and trusted users; normal users only pick provider candidates. Limits: `IMAGE_QUOTA_MB` (default 200, own images per trusted user; provider images never count; the owner has no quota), `IMAGE_UPLOAD_MAX_MB` (default 5, per file before re-encoding), `IMAGE_MAX_DIMENSION` (default 1920, longest side in pixels) and `IMAGE_WEBP_QUALITY` (default 82). `IMAGE_ENCODED_BY` (`server` by default) set to `client` makes the browser recode uploads to WebP (quality 82, longest side `IMAGE_MAX_DIMENSION`) and the server only accept real WebP files within the limits, unchanged; in that mode copies of other sites' images are stored only when they already are WebP within the limits; otherwise the remote URL is kept and shown as a link (addresses that are not allowed and content that is not an image are still refused). The orphan cleanup never deletes an image stored or claimed in the last 24 hours. Provider access is configured with `TMDB_API_KEY` (a v3 key or v4 token, required for metadata refresh), `TMDB_LANGUAGE` (default `es-ES`), `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` (a Twitch application, for game search) `STEAMGRIDDB_TOKEN` and `STEAM_API_KEY` (a free Steam Web API key, for the Steam import; see [steam-import.md](steam-import.md)). No keys are bundled. Book search uses Open Library, which needs no key; `OPENLIBRARY_LANGUAGE` (an ISO 639-1 code, by default the language part of `TMDB_LANGUAGE`) picks the edition whose title, cover, publisher and ISBN are used.

## Installing the web app

The web app is an installable PWA (a web app manifest, icons and a small service worker) and needs HTTPS, as on the Cloudflare Worker. On Android Chrome, open the site, then the menu and "Install app" (or "Add to Home screen"). On iOS Safari, use Share, then "Add to Home Screen". It opens full screen with its own icon. The service worker only keeps the app shell available offline: the API, the public pages (`/u/`, `/privacy`) and images always go to the network, so editing needs a connection and the app says so when it is offline. A new deploy takes over on the next reload.

Release alerts as notifications on the installed app would need Web Push: a VAPID key pair kept as a Worker secret, a `push` and `notificationclick` handler in `sw.js`, an endpoint that stores each user's push subscription, and a sender that signs and posts the payload from the Worker or the connector (task 5vopg8). iOS only delivers Web Push to an app installed to the Home screen.

## More

Everything else about the Node server has its own page: [users.md](users.md) (sign-in, per-user settings, your data and deleting an account), [public-pages.md](public-pages.md), [jellyfin-sync.md](jellyfin-sync.md), [release-alerts.md](release-alerts.md), [mirror.md](mirror.md), [backups.md](backups.md) and, for the database migrations and building from source, [development.md](development.md).
