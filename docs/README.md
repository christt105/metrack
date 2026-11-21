# Documentation

metrack runs either as a Cloudflare Worker with D1 and R2 (the cloud version, optionally with the home connector) or self-hosted as a Node server with SQLite.

## Self-hosted (Node and SQLite)

- [self-hosting.md](self-hosting.md): quick start, Docker, images and releases, installing the web app.
- [users.md](users.md): security model, per-user settings, your data and deleting an account.
- [public-pages.md](public-pages.md): the read-only public pages of each library.
- [jellyfin-sync.md](jellyfin-sync.md): syncing viewings from Jellyfin and Jellystat.
- [steam-import.md](steam-import.md): importing a Steam library, on the server and on the Worker.
- [skip-filler.md](skip-filler.md): skipping the filler episodes of an anime with AnimeFillerList's lists.
- [release-alerts.md](release-alerts.md): release alerts over ntfy.
- [backups.md](backups.md): scheduled backups, restore and copy to another disk.
- [mirror.md](mirror.md): mirroring the library to an Obsidian vault.

## Cloud (Cloudflare)

- [worker.md](worker.md): deploying the Cloudflare Worker.
- [connector.md](connector.md): the home connector that syncs Jellyfin and copies the cloud data, including the Cloudflare usage alerts.

## Reference

- [screenshots.md](screenshots.md): the web app and the public pages on desktop and phone.
- [api.md](api.md): the HTTP API.
- [development.md](development.md): layout, building, dependencies and migrations.
