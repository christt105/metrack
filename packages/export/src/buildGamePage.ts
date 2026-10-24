import type { Videogame } from '@metrack/domain';
import { buildPage } from './buildPage.js';
import { dateField } from './dateField.js';
import type { Page } from './Page.js';
import type { PageContext } from './PageContext.js';
import { trackingFields } from './trackingFields.js';

export function buildGamePage(game: Videogame, context: PageContext): Page {
  return buildPage(
    {
      section: 'games',
      slug: context.slugs.videogames.get(game.id)!,
      fields: {
        title: game.title,
        type: 'videogame',
        igdb_id: game.igdbId,
        steam_appid: game.steamAppId,
        steamgriddb_id: game.steamGridDbId,
        developer: game.developer,
        platforms: game.platforms,
        release_date: dateField(game.releaseDate),
        overview: game.overview,
        genres: game.genres,
        tags: game.tags,
        ...trackingFields(game),
      },
      review: game.review,
      artwork: { cover: game.cover, banner: game.banner },
    },
    context,
  );
}
