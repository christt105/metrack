import { randomBytes } from 'node:crypto';
import {
  INVITE_LIMITS,
  type CreateInviteRequest,
  type CreatedInvite,
  type Invite,
  type InvitePreview,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import { hashSecret } from '../auth/hashSecret.js';
import type { InviteRepository } from '../storage/repositories/InviteRepository.js';
import type { StoredInvite } from '../storage/repositories/StoredInvite.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import { OWNER_ID } from '../users/OWNER_ID.js';
import { inviteStatus } from './inviteStatus.js';

const DAY_MS = 24 * 3_600_000;

/**
 * Creates, lists, previews and revokes the owner's invitation links. Only the SHA-256 of a code is stored, so
 * the code is given back once, when the invitation is created.
 */
export class InviteService {
  constructor(
    private readonly invites: InviteRepository,
    private readonly users: UserRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(request: CreateInviteRequest): Promise<CreatedInvite> {
    const { maxUses } = request;
    const days = request.expiresInDays ?? INVITE_LIMITS.defaultExpiryDays;
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > INVITE_LIMITS.maxUses) {
      throw ApiError.badRequest(
        'invalid_invite_uses',
        `An invitation allows 1 to ${INVITE_LIMITS.maxUses} uses`,
      );
    }
    if (!Number.isInteger(days) || days < 1 || days > INVITE_LIMITS.maxExpiryDays) {
      throw ApiError.badRequest(
        'invalid_invite_expiry',
        `An invitation lasts 1 to ${INVITE_LIMITS.maxExpiryDays} days`,
      );
    }
    const now = this.now();
    const code = randomBytes(24).toString('base64url');
    const stored = await this.invites.create({
      codeHash: hashSecret(code),
      maxUses,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + days * DAY_MS).toISOString(),
    });
    return { invite: this.present(stored), code };
  }

  async list(): Promise<Invite[]> {
    return (await this.invites.list()).map((invite) => this.present(invite));
  }

  /** What the public invitation page shows. It reads and spends nothing. */
  async preview(code: string): Promise<InvitePreview> {
    const stored = await this.invites.byCodeHash(hashSecret(code));
    if (!stored) return { status: 'unknown', inviter: '' };
    const inviter = (await this.users.get(OWNER_ID))?.name ?? '';
    return { status: inviteStatus(stored, this.now()), inviter };
  }

  revoke(id: number): Promise<boolean> {
    return this.invites.revoke(id, this.now().toISOString());
  }

  private present(stored: StoredInvite): Invite {
    return { ...stored, status: inviteStatus(stored, this.now()) };
  }
}
