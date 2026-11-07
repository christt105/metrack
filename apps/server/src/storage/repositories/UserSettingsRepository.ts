import type { UserSettings } from '../../users/UserSettings.js';

/**
 * Settings by explicit user id. It is not scoped: the instance reads everyone's to decide whose jobs run, and
 * only the instance (the command line, the job runners) writes them.
 */
export interface UserSettingsRepository {
  /** Undefined when the user never stored any. */
  get(userId: number): Promise<UserSettings | undefined>;
  save(userId: number, settings: UserSettings): Promise<void>;
  /** The users with stored settings, ordered by id. */
  list(): Promise<{ userId: number; settings: UserSettings }[]>;
}
