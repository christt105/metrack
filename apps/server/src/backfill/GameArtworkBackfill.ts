import type { ImageStore } from '../images/ImageStore.js';
import type { Logger } from '../notify/Logger.js';
import type { IgdbClient } from '../providers/igdb/IgdbClient.js';
import type { IgdbGame } from '../providers/igdb/IgdbGame.js';
import { igdbImageUrl } from '../providers/igdb/igdbImageUrl.js';
import { steamArtwork } from '../providers/igdb/steamArtwork.js';
import type { SteamGridDbClient } from '../providers/steamgriddb/SteamGridDbClient.js';
import type { GameArtworkRepository } from '../storage/repositories/GameArtworkRepository.js';
import type { PendingGameArtwork } from '../storage/repositories/PendingGameArtwork.js';
import { GAME_ARTWORK_COST } from './GameArtworkCost.js';

/** The subrequests one invocation may spend inside a batch: the Workers free plan limit less what the request spends around it. */
export const GAME_ARTWORK_BUDGET = 45;

interface ArtworkRun {
  igdb?: Promise<IgdbGame | null>;
  fellBack: boolean;
}

/**
 * Prepares the artwork of games added with deferred artwork (the Steam import): archives their cover and banner,
 * links the game to its SteamGridDB id and clears the pending flag. When the Steam library art of a game cannot be
 * fetched (Steam has none for some apps), the IGDB cover and first screenshot replace it, exactly as adding a game
 * does. Every game is attempted once: the flag is always cleared afterwards, and an image that could not be obtained
 * is left empty (or, for IGDB art, left linked), so a game that keeps failing cannot hold the queue. A database
 * failure is not swallowed and leaves the game pending.
 */
export class GameArtworkBackfill {
  constructor(
    private readonly artwork: GameArtworkRepository,
    private readonly images: ImageStore,
    private readonly igdb: IgdbClient,
    private readonly steamGridDb: SteamGridDbClient | null,
    private readonly logger: Logger,
  ) {}

  /**
   * Prepares as many pending games as fit in `budget` subrequests, lowest id first, and answers how many it
   * finished. With `userId`, only games in that user's library are prepared.
   */
  async runBatch(options: { userId?: number; budget?: number } = {}): Promise<number> {
    const budget = options.budget ?? GAME_ARTWORK_BUDGET;
    let spent = 1;
    const limit = Math.max(1, Math.floor(budget / GAME_ARTWORK_COST.linked));
    const pending = await this.artwork.listPending(limit, options.userId);
    let done = 0;
    for (const game of pending) {
      if (spent + GAME_ARTWORK_COST.fallback > budget) break;
      const run: ArtworkRun = { fellBack: false };
      await this.prepare(game, run);
      spent += run.fellBack ? GAME_ARTWORK_COST.fallback : GAME_ARTWORK_COST.linked;
      done += 1;
    }
    return done;
  }

  /** How many games still wait for artwork; with `userId`, only those in that user's library. */
  async remaining(userId?: number): Promise<number> {
    return this.artwork.countPending(userId);
  }

  private async prepare(game: PendingGameArtwork, run: ArtworkRun): Promise<void> {
    const steam = game.steamAppId ? steamArtwork(game.steamAppId) : null;
    const cover = await this.settle(game.cover, 'cover', steam?.cover, run, game, (found) =>
      igdbImageUrl(found.cover?.url, 'cover_big'),
    );
    const banner = await this.settle(game.banner, 'banner', steam?.banner, run, game, (found) =>
      igdbImageUrl(found.screenshots?.[0]?.url, 'screenshot_huge'),
    );
    const steamGridDbId = game.steamAppId ? await this.steamGridDbId(game.steamAppId) : null;
    await this.artwork.complete(game.id, { cover, banner, steamGridDbId });
  }

  private async settle(
    url: string | null,
    display: 'cover' | 'banner',
    steamUrl: string | undefined,
    run: ArtworkRun,
    game: PendingGameArtwork,
    pick: (found: IgdbGame) => string | null,
  ): Promise<string | null> {
    if (!url) return null;
    try {
      await this.images.archive(url, display);
      return url;
    } catch {
      if (url !== steamUrl) return url;
    }
    run.fellBack = true;
    const found = await this.igdbGame(game, run);
    const replacement = found ? pick(found) : null;
    if (!replacement) return null;
    await this.images.archive(replacement, display).catch(() => undefined);
    return replacement;
  }

  private igdbGame(game: PendingGameArtwork, run: ArtworkRun): Promise<IgdbGame | null> {
    run.igdb ??= game.igdbId
      ? this.igdb.game(game.igdbId).catch((error: unknown) => {
          this.logger.error(
            `game artwork: IGDB lookup of game ${game.id} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        })
      : Promise.resolve(null);
    return run.igdb;
  }

  private async steamGridDbId(steamAppId: string): Promise<number | null> {
    if (!this.steamGridDb) return null;
    return this.steamGridDb.gameIdForSteamApp(steamAppId).catch(() => null);
  }
}
