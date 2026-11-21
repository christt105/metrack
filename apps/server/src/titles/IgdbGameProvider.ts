import {
  normalizePlatforms,
  steamPlatforms,
  isLinkedImageUrl,
  type EntityRef,
  type SearchResult,
  type Videogame,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import type { ImageStore } from '../images/ImageStore.js';
import { emptyVideogame } from '../media/emptyEntities.js';
import type { IgdbClient } from '../providers/igdb/IgdbClient.js';
import type { IgdbGame } from '../providers/igdb/IgdbGame.js';
import { igdbImageUrl } from '../providers/igdb/igdbImageUrl.js';
import { steamArtwork } from '../providers/igdb/steamArtwork.js';
import type { SteamGridDbClient } from '../providers/steamgriddb/SteamGridDbClient.js';
import type { GameArtworkRepository } from '../storage/repositories/GameArtworkRepository.js';
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

function linked(url: string | null): string | null {
  return url && isLinkedImageUrl(url) ? url : null;
}

function names(items: { name?: string }[] | undefined): string[] {
  return (items ?? []).flatMap((item) => (item.name ? [item.name] : []));
}

/**
 * Games from IGDB. Adding a game stores its metadata once (games have no metadata refresh) and its
 * artwork: the official Steam library art when the game is on Steam, else the IGDB cover and first
 * screenshot. With SteamGridDB configured, the game is also linked to its SteamGridDB id so the
 * artwork picker can offer community art. The Steam import adds games with deferred artwork instead.
 */
export class IgdbGameProvider implements TitleProvider {
  readonly type = 'videogame';
  readonly provider = 'igdb';

  constructor(
    private readonly client: IgdbClient,
    private readonly games: VideogameRepository,
    private readonly images: ImageStore,
    private readonly steamGridDb: SteamGridDbClient | null,
    private readonly artwork: GameArtworkRepository,
  ) {}

  async search(query: string, year: number | null): Promise<SearchResult[]> {
    const found = await this.client.search(query, year);
    return Promise.all(
      found.map(async (game) => {
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
          existingId: (await this.games.findByIgdbId(game.id))?.id ?? null,
        };
      }),
    );
  }

  async add(externalId: string): Promise<EntityRef> {
    return this.addWith(externalId, {});
  }

  /** Like `add`, with the user's own fields (status, time spent) written in the same step. */
  async addWith(externalId: string, entry: Partial<Videogame>): Promise<EntityRef> {
    const igdbId = parseNumericId(externalId);
    await this.requireNew(igdbId);
    const { game, steamAppId } = await this.load(igdbId);
    const steam = steamAppId ? steamArtwork(steamAppId) : null;
    const cover =
      (await this.download(steam?.cover, 'cover')) ??
      (await this.download(igdbImageUrl(game.cover?.url, 'cover_big'), 'cover'));
    const banner =
      (await this.download(steam?.banner, 'banner')) ??
      (await this.download(igdbImageUrl(game.screenshots?.[0]?.url, 'screenshot_huge'), 'banner'));
    return this.store(igdbId, game, steamAppId, {
      cover,
      banner,
      steamGridDbId: steamAppId ? await this.steamGridDbId(steamAppId) : null,
      entry,
    });
  }

  /**
   * Like `addWith`, but the artwork is not fetched: the game keeps the linked Steam library cover and hero (or the
   * IGDB cover and first screenshot without a Steam app), has no SteamGridDB id yet and is marked as waiting for
   * `GameArtworkBackfill`, which archives the images and fills in the rest. It does not look for the game in the
   * catalog first, to save a query: the caller has just classified it as new.
   */
  async addWithDeferredArtwork(externalId: string, entry: Partial<Videogame>): Promise<EntityRef> {
    const igdbId = parseNumericId(externalId);
    const { game, steamAppId } = await this.load(igdbId);
    const steam = steamAppId ? steamArtwork(steamAppId) : null;
    const ref = await this.store(igdbId, game, steamAppId, {
      cover: linked(steam?.cover ?? igdbImageUrl(game.cover?.url, 'cover_big')),
      banner: linked(steam?.banner ?? igdbImageUrl(game.screenshots?.[0]?.url, 'screenshot_huge')),
      steamGridDbId: null,
      entry,
      platforms: steamPlatforms(names(game.platforms)),
    });
    await this.artwork.markPending(ref.id);
    return ref;
  }

  private async requireNew(igdbId: number): Promise<void> {
    const existing = await this.games.findByIgdbId(igdbId);
    if (existing) {
      throw ApiError.conflict('already_added', 'That game is already in the tracker', {
        existingId: existing.id,
      });
    }
  }

  private async load(igdbId: number): Promise<{ game: IgdbGame; steamAppId: string | null }> {
    const game = await this.client.game(igdbId);
    if (!game) throw ApiError.notFound('IGDB has no game with that id');
    const steamAppId =
      game.external_games?.find((e) => e.external_game_source === STEAM_SOURCE && e.uid)?.uid ??
      null;
    return { game, steamAppId };
  }

  private async store(
    igdbId: number,
    game: IgdbGame,
    steamAppId: string | null,
    artwork: {
      cover: string | null;
      banner: string | null;
      steamGridDbId: number | null;
      entry: Partial<Videogame>;
      platforms?: string[];
    },
  ): Promise<EntityRef> {
    const created = await this.games.create({
      ...emptyVideogame(),
      igdbId,
      steamAppId,
      steamGridDbId: artwork.steamGridDbId,
      title: game.name ?? `IGDB ${igdbId}`,
      releaseDate: dateOf(game),
      overview: textOf(game.storyline) ?? textOf(game.summary),
      genres: names(game.genres),
      developer:
        game.involved_companies?.find((c) => c.developer && c.company?.name)?.company?.name ?? null,
      platforms: artwork.platforms ?? normalizePlatforms(names(game.platforms)),
      cover: artwork.cover,
      banner: artwork.banner,
      ...artwork.entry,
    });
    return { type: 'videogame', id: created.id };
  }

  private async steamGridDbId(steamAppId: string): Promise<number | null> {
    if (!this.steamGridDb) return null;
    return this.steamGridDb.gameIdForSteamApp(steamAppId).catch(() => null);
  }

  private async download(
    url: string | null | undefined,
    display: 'cover' | 'banner',
  ): Promise<string | null> {
    if (!url) return null;
    try {
      return await this.images.reference(url, display);
    } catch {
      return null;
    }
  }
}
