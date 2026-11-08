import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { AccountDeletion, AccountStatus } from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type { AccountRepository } from '../storage/repositories/AccountRepository.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import { OWNER_ID } from '../users/OWNER_ID.js';
import { lastDueRequest, scheduleOf } from './AccountDeletionSchedule.js';

/**
 * Schedules, cancels and carries out account deletions. A request waits out the grace period; `eraseDue`
 * then deletes each account that has passed it, together with the images only that account owned that
 * nothing uses and the account's folder in the data directory. The owner's account is never deleted.
 */
export class AccountDeletionService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly users: UserRepository,
    private readonly images: ImageStore,
    private readonly dataDir: string,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
    private readonly notifierFor?: (userId: number) => Notifier,
  ) {}

  async status(userId: number): Promise<AccountStatus> {
    const requestedAt = await this.accounts.deletionRequestedAt(userId);
    return {
      deletion: requestedAt === null ? null : scheduleOf(requestedAt),
      canDelete: userId !== OWNER_ID,
    };
  }

  /** Schedules the deletion; a request already waiting keeps its original date. `notify` tells the user, for requests they did not make. */
  async request(userId: number, notify = false): Promise<AccountDeletion> {
    if (userId === OWNER_ID) {
      throw new ApiError(403, 'owner_cannot_delete', 'The owner account cannot be deleted');
    }
    if (!(await this.users.get(userId))) throw ApiError.notFound('That user does not exist');
    const waiting = await this.accounts.deletionRequestedAt(userId);
    const requestedAt = await this.accounts.requestDeletion(userId, this.now().toISOString());
    const deletion = scheduleOf(requestedAt);
    if (notify && waiting === null) {
      await this.notifierFor?.(userId).notify(
        'Your metrack account will be deleted',
        `Your account and data will be erased on ${deletion.deleteAt.slice(0, 10)}. Sign in to metrack before then to cancel.`,
      );
    }
    return deletion;
  }

  /** Cancels a waiting deletion; false when none was waiting. */
  async cancel(userId: number, notify = false): Promise<boolean> {
    const cancelled = await this.accounts.cancelDeletion(userId);
    if (cancelled && notify) {
      await this.notifierFor?.(userId).notify(
        'Your metrack account deletion was cancelled',
        'Your account stays as it was.',
      );
    }
    return cancelled;
  }

  /** Erases every account whose grace period has passed and answers their ids. A failure is logged and does not stop the rest. */
  async eraseDue(): Promise<number[]> {
    const erased: number[] = [];
    for (const userId of await this.accounts.dueForDeletion(lastDueRequest(this.now()))) {
      try {
        await this.erase(userId);
        erased.push(userId);
      } catch (error) {
        this.logger.error(
          `deleting account ${userId} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return erased;
  }

  private async erase(userId: number): Promise<void> {
    const owned = await this.accounts.erase(userId);
    const removed = await this.images.removeUnused(owned);
    await rm(join(this.dataDir, 'users', String(userId)), { recursive: true, force: true });
    this.logger.info(
      `deleted account ${userId} (${owned.length} images owned, ${removed.length} removed)`,
    );
  }
}
