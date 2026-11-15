import type { User } from '@metrack/domain';
import { INVITE_USES_SQL, inviteFromRows } from '../mapping/inviteFromRows.js';
import { inviteRedemptionStatements } from '../mapping/inviteRedemptionStatements.js';
import { userFromRow } from '../mapping/userFromRow.js';
import type { InviteRedemption } from '../repositories/InviteRedemption.js';
import type { InviteRepository } from '../repositories/InviteRepository.js';
import type { NewInvite } from '../repositories/NewInvite.js';
import type { StoredInvite } from '../repositories/StoredInvite.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll, queryFirst, statement } from './d1Query.js';

export class D1InviteRepository implements InviteRepository {
  constructor(private readonly db: D1Database) {}

  async create(invite: NewInvite): Promise<StoredInvite> {
    const meta = await execute(
      this.db,
      'INSERT INTO invite (code_hash, max_uses, created_at, expires_at) VALUES (?, ?, ?, ?)',
      invite.codeHash,
      invite.maxUses,
      invite.createdAt,
      invite.expiresAt,
    );
    return this.byId(meta.last_row_id);
  }

  async list(): Promise<StoredInvite[]> {
    const [invites, uses] = await Promise.all([
      queryAll(this.db, 'SELECT * FROM invite ORDER BY created_at DESC, id DESC'),
      queryAll(this.db, `${INVITE_USES_SQL} ORDER BY u.id`),
    ]);
    return invites.map((row) =>
      inviteFromRows(
        row,
        uses.filter((use) => use.invite_id === row.id),
      ),
    );
  }

  async byCodeHash(codeHash: string): Promise<StoredInvite | undefined> {
    const row = await queryFirst(this.db, 'SELECT * FROM invite WHERE code_hash = ?', codeHash);
    return row ? this.byId(Number(row.id)) : undefined;
  }

  async revoke(id: number, at: string): Promise<boolean> {
    const meta = await execute(
      this.db,
      'UPDATE invite SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL AND uses < max_uses',
      at,
      id,
    );
    return meta.changes > 0;
  }

  async redeem(redemption: InviteRedemption): Promise<User | undefined> {
    const results = await this.db.batch(
      inviteRedemptionStatements(redemption).map((entry) =>
        statement(this.db, entry.sql, entry.params),
      ),
    );
    if ((results[1]?.meta.changes ?? 0) === 0) return undefined;
    const row = await queryFirst(
      this.db,
      'SELECT * FROM user WHERE google_sub = ?',
      redemption.googleSub,
    );
    return row ? userFromRow(row) : undefined;
  }

  private async byId(id: number): Promise<StoredInvite> {
    const [row, uses] = await Promise.all([
      queryFirst(this.db, 'SELECT * FROM invite WHERE id = ?', id),
      queryAll(this.db, `${INVITE_USES_SQL} WHERE u.invite_id = ? ORDER BY u.id`, id),
    ]);
    if (!row) throw new Error('The invitation was not stored');
    return inviteFromRows(row, uses);
  }
}
