import type { DatabaseSync } from 'node:sqlite';
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

export class SqliteGameArtworkRepository implements GameArtworkRepository {
  constructor(private readonly db: DatabaseSync) {}

  async markPending(id: number): Promise<void> {
    this.db.prepare(MARK_ARTWORK_PENDING_SQL).run(id);
  }

  async listPending(limit: number, userId?: number): Promise<PendingGameArtwork[]> {
    const rows =
      userId === undefined
        ? this.db.prepare(LIST_PENDING_ARTWORK_SQL).all(limit)
        : this.db.prepare(LIST_PENDING_ARTWORK_OF_USER_SQL).all(userId, limit);
    return rows.map(pendingArtworkFromRow);
  }

  async countPending(userId?: number): Promise<number> {
    const row =
      userId === undefined
        ? this.db.prepare(COUNT_PENDING_ARTWORK_SQL).get()
        : this.db.prepare(COUNT_PENDING_ARTWORK_OF_USER_SQL).get(userId);
    return Number(row?.n ?? 0);
  }

  async complete(
    id: number,
    artwork: { cover: string | null; banner: string | null; steamGridDbId: number | null },
  ): Promise<void> {
    this.db
      .prepare(COMPLETE_ARTWORK_SQL)
      .run(artwork.cover, artwork.banner, artwork.steamGridDbId, id);
  }
}
