import type { DatabaseSync } from 'node:sqlite';
import type { User } from '@metrack/domain';
import { INVITE_USES_SQL, inviteFromRows } from '../mapping/inviteFromRows.js';
import { inviteRedemptionStatements } from '../mapping/inviteRedemptionStatements.js';
import { userFromRow } from '../mapping/userFromRow.js';
import type { InviteRedemption } from '../repositories/InviteRedemption.js';
import type { InviteRepository } from '../repositories/InviteRepository.js';
import type { NewInvite } from '../repositories/NewInvite.js';
import type { StoredInvite } from '../repositories/StoredInvite.js';

export class SqliteInviteRepository implements InviteRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(invite: NewInvite): Promise<StoredInvite> {
    const result = this.db
      .prepare(
        'INSERT INTO invite (code_hash, max_uses, created_at, expires_at) VALUES (?, ?, ?, ?)',
      )
      .run(invite.codeHash, invite.maxUses, invite.createdAt, invite.expiresAt);
    return this.byId(Number(result.lastInsertRowid));
  }

  async list(): Promise<StoredInvite[]> {
    const uses = this.db.prepare(`${INVITE_USES_SQL} ORDER BY u.id`).all();
    return this.db
      .prepare('SELECT * FROM invite ORDER BY created_at DESC, id DESC')
      .all()
      .map((row) =>
        inviteFromRows(
          row,
          uses.filter((use) => use.invite_id === row.id),
        ),
      );
  }

  async byCodeHash(codeHash: string): Promise<StoredInvite | undefined> {
    const row = this.db.prepare('SELECT * FROM invite WHERE code_hash = ?').get(codeHash);
    return row ? this.byId(Number(row.id)) : undefined;
  }

  async revoke(id: number, at: string): Promise<boolean> {
    const result = this.db
      .prepare(
        'UPDATE invite SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL AND uses < max_uses',
      )
      .run(at, id);
    return Number(result.changes) > 0;
  }

  async redeem(redemption: InviteRedemption): Promise<User | undefined> {
    this.db.exec('BEGIN');
    try {
      const [take, insertUser, insertUse] = inviteRedemptionStatements(redemption);
      this.db.prepare(take!.sql).run(...take!.params);
      const created = this.db.prepare(insertUser!.sql).run(...insertUser!.params);
      this.db.prepare(insertUse!.sql).run(...insertUse!.params);
      this.db.exec('COMMIT');
      if (Number(created.changes) === 0) return undefined;
      const row = this.db
        .prepare('SELECT * FROM user WHERE google_sub = ?')
        .get(redemption.googleSub);
      return row ? userFromRow(row) : undefined;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private byId(id: number): StoredInvite {
    const row = this.db.prepare('SELECT * FROM invite WHERE id = ?').get(id);
    if (!row) throw new Error('The invitation was not stored');
    const uses = this.db.prepare(`${INVITE_USES_SQL} WHERE u.invite_id = ? ORDER BY u.id`).all(id);
    return inviteFromRows(row, uses);
  }
}
