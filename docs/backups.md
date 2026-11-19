# Backups

This page covers the backups of the self-hosted server (SQLite). Backups of the cloud data (D1 and R2) are made by the home connector, see [connector.md](connector.md#8-daily-copy-of-the-cloud-data).

The server writes a backup every `BACKUP_INTERVAL_HOURS` (default 24) to `/data/backups`, keeping the newest `BACKUP_RETENTION` (default 14). A check runs at startup and every 10 minutes, and a backup is taken when the newest one is older than the interval, so a restart after downtime catches up. After a failure the next attempt waits 10 minutes, doubling on each consecutive failure up to the interval. A run of failures sends one alert, and one more message when a backup succeeds again. Set `BACKUP_ENABLED=false` to turn the scheduler off.

Each backup is a directory `metrack-<UTC timestamp>` containing `metrack.db`, a consistent copy made with `VACUUM INTO` that is checked with `PRAGMA integrity_check` before it is accepted, and `images/` when `/data/images` exists. A failed backup leaves nothing behind.

| Variable                               | Default             | Meaning                                                                                                 |
| -------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `BACKUP_ENABLED`                       | `true`              | Run the internal scheduler                                                                              |
| `BACKUP_DIR`                           | `$DATA_DIR/backups` | Where backups are written                                                                               |
| `BACKUP_RETENTION`                     | `14`                | Number of backups to keep                                                                               |
| `BACKUP_INTERVAL_HOURS`                | `24`                | Minimum age of the newest backup before a new one is taken                                              |
| `NTFY_URL`, `NTFY_TOPIC`, `NTFY_TOKEN` | unset               | Send a failure alert to ntfy; `NTFY_TOKEN` is optional. Without URL and topic, failures are only logged |

`NTFY_URL` and `NTFY_TOKEN` are also the server every user's alerts go through, to the topic in their settings; `NTFY_TOPIC` is only for instance alerts such as backups, and the starting topic of user 1.

Manual use:

```sh
curl -X POST http://localhost:8097/api/backups
curl http://localhost:8097/api/backups
docker exec metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js backups
docker exec metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js backup
```

### Restore

Stop the service first, since the database file is replaced. Then run the restore in a one-off container (the name comes from `backups`) and start the service again. The backup is re-verified and copied next to the live data before anything is overwritten. The database and image store being replaced are then moved to `/data/pre-restore-<UTC timestamp>` (the command prints the path), and the backup takes their place. To undo a restore, stop the service and move `metrack.db` and `images/` back from that directory. Safety directories are never deleted automatically; remove them once the restored data looks right.

```sh
docker compose stop metrack
docker compose run --rm metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js restore metrack-20261024T031500000Z
docker compose start metrack
```

A test restores a backup over a modified database and image store and checks the result matches the original and the replaced data is kept in the safety directory.

### Copy to another disk

Backups live next to the database, so a dead disk takes both. Set `BACKUP_COPY_DIR` to a folder on another disk, mounted into the container, and after each successful backup the server copies every backup still missing there: the database of each one as `databases/metrack-<UTC timestamp>.db` (checked with `PRAGMA integrity_check` before it is accepted) and the images into one shared `images/` folder. Images are named by their hash and never change, so each is copied once however many backups hold it, and a copy grows with new images rather than with days. After retention removes old databases, the images that none of the kept databases lists are removed from the copy too (if any kept database cannot be read, no image is removed), so a deleted account's images leave the copy together with the last backup that held them. A database is only written after all its images, and every file goes through a temporary name, so an interrupted copy leaves nothing half-written. When running as root, new files take the owner of the folder they land in.

| Variable                | Default | Meaning                                                                                       |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `BACKUP_COPY_DIR`       | unset   | Folder that receives the copy; unset means no copy                                            |
| `BACKUP_COPY_RETENTION` | `14`    | Number of copied databases to keep; an image stays in the copy while a kept database lists it |

A failed copy does not fail the backup. It is logged, sends one alert per run of failures and one more when a copy succeeds again, and the next backup copies everything still missing, so days missed while the disk was unavailable catch up.

```yaml
volumes:
  - ${METRACK_DATA:-./data}:/data
  - /mnt/other-disk/metrack:/backup-copy
environment:
  BACKUP_COPY_DIR: /backup-copy
```

To restore from the copy, `retrieve` rebuilds a copied backup as a regular backup under `backups/` (with every image in the copy; remove unused images afterwards to drop the extra ones), and `restore` takes it from there:

```sh
docker exec metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js copies
docker exec metrack node --disable-warning=ExperimentalWarning apps/server/dist/cli.js retrieve metrack-20261024T031500000Z
```

To copy off the machine instead, sync the bind-mounted `${METRACK_DATA}/backups` folder from the host, for example `rclone sync /path/to/metrack-data/backups remote:metrack-backups`. Backups are immutable directories, so syncing the whole folder is safe; place one back under `backups/` to restore it.
