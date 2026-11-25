# Third-party notices

## Vendored browser assets

The web app (`apps/web`) and the public pages (`packages/site`) ship their text font themselves, so no request leaves for a CDN:

- [Host Grotesk](https://github.com/Element-Type/HostGrotesk) (`apps/web/src/assets/fonts`, and as base64 in `HOST_GROTESK_LATIN_WOFF2` and `HOST_GROTESK_LATIN_EXT_WOFF2` under `packages/site/src/assets`, the latin and latin-ext subsets of the variable font as Google Fonts serves them): SIL Open Font License 1.1, Copyright 2023 The Host Grotesk Project Authors. The license is at https://openfontlicense.org.

## TMDB logo and data providers

- [TMDB](https://www.themoviedb.org) logo (blue, short version, unmodified, `apps/web/src/assets/tmdb-logo.svg` and `TMDB_LOGO_SVG` under `packages/site/src/assets`): the web app's About section and the public pages' footer and privacy page use it, with the notice "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." (the pages say "website"), as TMDB's API terms require. The logo belongs to TMDB and is used under those terms; it is not covered by this project's license.
- Data and images also come from [IGDB](https://www.igdb.com), [Open Library](https://openlibrary.org), [Steam](https://store.steampowered.com) and [SteamGridDB](https://www.steamgriddb.com), credited by name with a link in the same places. Their wording requirements, if any, are not recorded here.
- [AnimeFillerList](https://www.animefillerlist.com): the episode lists behind "Skip the filler" are read from its public pages on demand and never stored or redistributed; it is credited by name with a link in the web app's About section. See `docs/skip-filler.md`.
