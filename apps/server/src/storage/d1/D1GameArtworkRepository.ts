import {
  COMPLETE_ARTWORK_SQL,
  COUNT_PENDING_ARTWORK_OF_USER_SQL,
  COUNT_PENDING_ARTWORK_SQL,
  LIST_PENDING_ARTWORK_OF_USER_SQL,
  LIST_PENDING_ARTWORK_SQL,
  MARK_ARTWORK_PENDING_SQL,
} from '../mapping/gameArtworkSql.js';
import { pendingArtworkFromRow } from '../mapping/pendingArtworkFromRow.js';
import type { GameArtworkRepository } from '../repositories/GameArtworkRepository.js';
import type { PendingGameArtwork } from '../repositories/PendingGameArtwork.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll } from './d1Query.js';

export class D1GameArtworkRepository implements GameArtworkRepository {
  constructor(private readonly db: D1Database) {}

  async markPending(id: number): Promise<void> {
    await execute(this.db, MARK_ARTWORK_PENDING_SQL, id);
  }

  async listPending(limit: number, userId?: number): Promise<PendingGameArtwork[]> {
    const rows =
      userId === undefined
        ? await queryAll(this.db, LIST_PENDING_ARTWORK_SQL, limit)
        : await queryAll(this.db, LIST_PENDING_ARTWORK_OF_USER_SQL, userId, limit);
    return rows.map(pendingArtworkFromRow);
  }

  async countPending(userId?: number): Promise<number> {
    const rows =
      userId === undefined
        ? await queryAll(this.db, COUNT_PENDING_ARTWORK_SQL)
        : await queryAll(this.db, COUNT_PENDING_ARTWORK_OF_USER_SQL, userId);
    return Number(rows[0]?.n ?? 0);
  }

  async complete(
    id: number,
    artwork: { cover: string | null; banner: string | null; steamGridDbId: number | null },
  ): Promise<void> {
    await execute(
      this.db,
      COMPLETE_ARTWORK_SQL,
      artwork.cover,
      artwork.banner,
      artwork.steamGridDbId,
      id,
    );
  }
}
