# Mirroring to the Obsidian vault

```sh
npm run metrack -w @metrack/server -- mirror "/path/to/vault/Media Tracker" --web-url http://192.168.1.15:8100
npm run metrack -w @metrack/server -- mirror "/path/to/vault/Media Tracker" --web-url http://192.168.1.15:8100 --apply
```

Once the web app is the only place where tracking is edited, `mirror` keeps a read-only copy of the library in the vault so other notes can link to it (`[[Predestination (2014)]]` from a journal entry). It writes one note per page of the site, in the format and folders the Obsidian plugin used (`Movies`, `TVs`, `Seasons`, `Juegos`, `Books`) and with the same file names, so existing links keep working and the old Hugo migration script can still read the folder. Any edit made in Obsidian to these notes is overwritten on the next run.

Without `--apply` it only reports which notes would be created, changed or removed. With `--apply` it writes through a temporary file and a rename, and only notes whose text changes. Properties the database does not hold (`related`, `aliases`, `cssclasses`, `category`...) stay as written, and so do values that already mean the same thing: a cover URL or `[[file]]` for the same image, season links written with folders or aliases, a review whose only difference is how its images are embedded. A series with season notes gets its status from its seasons (in progress while one is, completed once one is finished and the rest are not started) and the latest finish date; it has no rating of its own.

Covers keep their original URL when the image came from one; otherwise the note links a file in `Portadas` or `Files` with the same bytes, or the image is copied there as `metrack-<hash>.<ext>`. `--web-url` (or `VAULT_MIRROR_WEB_URL`) adds a `metrack` property linking to the item in the web app. `--link-prefix` is the folder's path inside the vault, `Media Tracker` by default.

The notes written are recorded in `vault-mirror-state.json` in the data directory. A note the mirror wrote before and that no longer matches an item (deleted, or renamed) is removed; notes it never wrote are listed and left alone.

### Automatic mirror

For every user with a vault folder in their settings (`mirrorDir`, see [Per-user settings](users.md#per-user-settings)), the server runs the mirror once at start and again a few seconds after every successful write under `/api`, so the vault follows every edit. `VAULT_MIRROR_WEB_URL` and the `mirrorLinkPrefix` setting work like the CLI options; `metrack mirror --user <id>` mirrors another user's notes. Failures are logged, retried with backoff and reported once through the user's ntfy topic. When the server runs as root (the Docker image), written files and folders take the owner of the folder they are written into, so the vault keeps belonging to its user. In Docker, mount the vault folder and set it for the user (`metrack users set 1 --mirror-dir "/vault/Media Tracker"`, or `VAULT_MIRROR_DIR` before the first start):

```yaml
environment:
  VAULT_MIRROR_WEB_URL: http://192.168.1.15:8100
volumes:
  - /path/to/vault/Media Tracker:/vault/Media Tracker
```
