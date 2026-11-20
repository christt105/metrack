# Skip the filler

On the page of an animated series (a genre of Animation, Animación or Anime), "Skip the filler" marks the filler episodes as skipped, so the seasons can complete without them. It uses the episode lists of [AnimeFillerList](https://www.animefillerlist.com), which has no API: metrack reads the show's page each time the preview is opened and stores nothing.

## How it works

1. metrack looks for the show by the slug of the series' title, then of its original title (`Naruto Shippūden` becomes `naruto-shippuden`). If neither exists, the page asks for the AnimeFillerList address of the show (or the name at the end of it) and tries again. Only `animefillerlist.com/shows/<slug>` addresses are accepted.
2. The list numbers every episode of the show from 1. metrack numbers its own episodes the same way: the seasons from 1 up (specials are left out) in season order, each season's episodes in the order of its catalog, which follows the series' episode group. The two are only paired when they have the same number of episodes; otherwise nothing is offered and the page says how many episodes each side has. A series that is still airing usually differs, and so do series split into seasons differently from the site.
3. The preview shows how many episodes fall in each category (filler, mixed canon and filler, manga canon, anime canon) and lists the filler and mixed ones. Filler is preselected, mixed episodes are not (each can be added, or the whole category), and canon episodes are never proposed. Episodes you watched at any date, and the ones already skipped, are shown but left out.
4. Confirming sends one `PATCH /api/seasons/{id}/episodes` with `{ "op": "skip", "keys": [...] }` per season. A notice offers to undo it, which unskips exactly those keys.

## API

`GET /api/series/{id}/filler?slug=` answers `{ slug, sourceUrl, counts, episodes }`, where `counts` has `filler`, `mixed`, `mangaCanon` and `animeCanon`, and each episode has `seasonId`, `seasonNumber`, `key`, `number`, `title`, `absoluteNumber`, `category`, `watched` and `skipped`. `slug` is optional and may be a slug or an AnimeFillerList address. Errors: 400 `invalid_filler_slug`, 404 `filler_not_found` (no list for the tried slugs), 409 `filler_count_mismatch` (with `ours` and `theirs` in `details`), 409 `filler_catalog_incomplete` (a season has no complete episode catalog yet), 409 `filler_list_invalid` (the list is not numbered 1 to N) and 502 `filler_source_unavailable`.

## Limits

- One request to AnimeFillerList per slug tried (at most two without an explicit slug), with a 10 second timeout, a 2 MB limit and a `User-Agent` naming metrack. On the Cloudflare Worker they count against the 50 external subrequests of an invocation together with the TMDB requests of seasons whose catalog is missing or stale, one per season.
- Nothing is cached, so opening the preview again reads the page again.
