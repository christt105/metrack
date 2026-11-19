# Release alerts

Following a series (`follow`) or a movie puts it on the watchlist (the "Following" page, or the button on its page). A worker asks TMDB about every followed title and sends an ntfy notification, with the poster attached, once per (movie or season, kind):

- `releases_tomorrow` the day before the release and `releases_today` on the day. These only fire on their exact day, so a late warning is never sent.
- `available_es` when TMDB lists a `flatrate` provider for Spain (`buy` and `rent` are ignored) for a release that happened in the last 14 days (seasons) or 60 days (movies).

The release date of a season is its `air_date`, or the date of `next_episode_to_air` when that is the first episode and the season has no date yet. For a movie it is the earliest Spanish premiere or limited release in `release_dates`, falling back to `release_date`. When TMDB announces a season of a followed series that is not stored, the season is created as `planned`. It is paired with an existing season by its stored TMDB number, then by the date of its first episode, and a season override can give it another number. Seasons that are missing locally but were released long ago are left alone. When the season shows up in Jellyfin under another number, the Jellyfin sync pairs it by date, so nothing is duplicated.

How often a title is asked about depends on how close its release is: every 30 minutes from the day before to the day after, every 3 hours while providers may still be catching up, and twice a day otherwise. The scheduler ticks every 10 minutes and keeps the due times in memory. Nothing is checked or sent before `ALERTS_NOTIFY_FROM_HOUR`, so alerts do not arrive at night. An alert is recorded in `release_alert` only once ntfy has accepted it, and recorded alerts are listed on the Following page; an alert ntfy does not accept stays pending and is retried 30 minutes later. Every user with an ntfy topic in their settings (`ntfyTopic`) gets alerts for what they follow, with their own due times. Alerts need `TMDB_API_KEY` and `NTFY_URL`.

| Variable                  | Default         | Meaning                                                      |
| ------------------------- | --------------- | ------------------------------------------------------------ |
| `ALERTS_ENABLED`          | `true`          | Run the worker                                               |
| `ALERTS_TIMEZONE`         | `Europe/Madrid` | Time zone that decides what "today" and "tomorrow" mean      |
| `ALERTS_NOTIFY_FROM_HOUR` | `8`             | Local hour (0 to 23) before which nothing is checked or sent |

Limitations:

- TMDB watch providers are JustWatch data, have no date and can lag by hours or days, so `available_es` can arrive later than the real availability.
- There is no free source for "episode X airs in Spain" for weekly broadcast series. Only season premieres are announced, never single episodes, and a season that streams all at once is detected by its provider listing.
- A season that TMDB lists without any date is not created or announced until it gets one. If a release date moves after an alert was sent, the alert is not repeated.
- Created seasons have no cover of their own and show the series cover until a metadata refresh or an image choice sets one.

## Cloudflare usage alerts

The home server and the home connector also watch the Cloudflare account usage and alert before a free-plan quota runs out; that is described in [connector.md](connector.md#10-cloudflare-usage-alerts).
