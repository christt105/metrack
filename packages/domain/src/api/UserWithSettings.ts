import type { User } from './User.js';
import type { UserSettings } from './UserSettings.js';

export interface UserWithSettings {
  user: User;
  settings: UserSettings;
}
