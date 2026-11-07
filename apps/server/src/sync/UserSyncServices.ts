import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import type { SyncService } from './SyncService.js';

/** Builds the sync of a user from the Jellyfin account in their settings, read again each time. */
export class UserSyncServices {
  constructor(
    private readonly settings: UserSettingsRepository,
    private readonly build: (jellyfinUser: string) => SyncService,
  ) {}

  /** Undefined when the user has no Jellyfin account set: nobody else's viewings are ever read for them. */
  async forUser(userId: number): Promise<SyncService | undefined> {
    const jellyfinUser = (await this.settings.get(userId))?.jellyfinUser;
    return jellyfinUser ? this.build(jellyfinUser) : undefined;
  }

  /** The users with a Jellyfin account set, ordered by id. */
  async users(): Promise<number[]> {
    return (await this.settings.list())
      .filter((entry) => entry.settings.jellyfinUser)
      .map((entry) => entry.userId);
  }
}
