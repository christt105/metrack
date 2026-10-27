import type { EntityRef, SearchResult } from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import type { ImageStore } from '../images/ImageStore.js';
import { emptyVideogame } from '../media/emptyEntities.js';
import type { IgdbClient } from '../providers/igdb/IgdbClient.js';
import type { IgdbGame } from '../providers/igdb/IgdbGame.js';
import { igdbImageUrl } from '../providers/igdb/igdbImageUrl.js';
import { steamArtwork } from '../providers/igdb/steamArtwork.js';
import type { SteamGridDbClient } from '../providers/steamgriddb/SteamGridDbClient.js';
import type { VideogameRepository } from '../storage/repositories/VideogameRepository.js';
import { parseNumericId } from './parseExternalId.js';
import type { TitleProvider } from './TitleProvider.js';

const STEAM_SOURCE = 1;

function dateOf(game: IgdbGame): string | null {
  return game.first_release_date
    ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
    : null;
}

function textOf(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

function names(items: { name?: string }[] | undefined): string[] {
  return (items ?? []).flatMap((item) => (item.name ? [item.name] : []));
}

/**
 * Games from IGDB. Adding a game stores its metadata once (games have no metadata refresh) and its
 * artwork: the official Steam library art when the game is on Steam, else the IGDB cover and first
 * screenshot. With SteamGridDB configured, the game is also linked to its SteamGridDB id so the
 * artwork picker can offer community art.
 */
export class IgdbGameProvider implements TitleProvider {
  readonly type = 'videogame';
  readonly provider = 'igdb';

  constructor(
    private readonly client: IgdbClient,
    private readonly games: VideogameRepository,
    private readonly images: ImageStore,
    private readonly steamGridDb: SteamGridDbClient | null = null,
  ) {}

  async search(query: string, year: number | null): Promise<SearchResult[]> {
    const found = await this.client.search(query, year);
    return found.map((game) => {
      const date = dateOf(game);
      return {
        type: 'videogame',
        provider: this.provider,
        externalId: String(game.id),
        title: game.name ?? '',
        originalTitle: null,
        year: date ? Number(date.slice(0, 4)) : null,
        overview: textOf(game.summary),
        posterUrl: igdbImageUrl(game.cover?.url, 'cover_small'),
        existingId: this.games.findByIgdbId(game.id)?.id ?? null,
      };
    });
  }

  async add(externalId: string): Promise<EntityRef> {
    const igdbId = parseNumericId(externalId);
    const existing = this.games.findByIgdbId(igdbId);
    if (existing) {
      throw ApiError.conflict('already_added', 'That game is already in the tracker', {
        existingId: existing.id,
      });
    }
    const game = await this.client.game(igdbId);
    if (!game) throw ApiError.notFound('IGDB has no game with that id');

    const steamAppId =
      game.external_games?.find((e) => e.external_game_source === STEAM_SOURCE && e.uid)?.uid ??
      null;
    const steam = steamAppId ? steamArtwork(steamAppId) : null;
    const cover =
      (await this.download(steam?.cover)) ??
      (await this.download(igdbImageUrl(game.cover?.url, 'cover_big')));
    const banner =
      (await this.download(steam?.banner)) ??
      (await this.download(igdbImageUrl(game.screenshots?.[0]?.url, 'screenshot_huge')));

    const created = this.games.create({
      ...emptyVideogame(),
      igdbId,
      steamAppId,
      steamGridDbId: steamAppId ? await this.steamGridDbId(steamAppId) : null,
      title: game.name ?? `IGDB ${igdbId}`,
      releaseDate: dateOf(game),
      overview: textOf(game.storyline) ?? textOf(game.summary),
      genres: names(game.genres),
      developer:
        game.involved_companies?.find((c) => c.developer && c.company?.name)?.company?.name ?? null,
      platforms: names(game.platforms),
      cover,
      banner,
    });
    return { type: 'videogame', id: created.id };
  }

  private async steamGridDbId(steamAppId: string): Promise<number | null> {
    if (!this.steamGridDb) return null;
    return this.steamGridDb.gameIdForSteamApp(steamAppId).catch(() => null);
  }

  private async download(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;
    try {
      return (await this.images.download(url)).ref;
    } catch {
      return null;
    }
  }
}
