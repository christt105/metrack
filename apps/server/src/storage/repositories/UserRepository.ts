import type { User, UserRole } from '@metrack/domain';
import type { NewUser } from './NewUser.js';

export interface UserRepository {
  create(user: NewUser): Promise<User>;
  get(id: number): Promise<User | undefined>;
  /** Ordered by id. */
  list(): Promise<User[]>;
  setRole(id: number, role: UserRole): Promise<void>;
  findByGoogleSub(sub: string): Promise<User | undefined>;
  /** The user with that email address, compared without regard to case. */
  findByEmail(email: string): Promise<User | undefined>;
  /** Stores the Google account identifier, only while the user has none; false when it did not. */
  linkGoogleSub(id: number, sub: string): Promise<boolean>;
  /** Replaces the Google account identifier, or removes it with null. */
  setGoogleSub(id: number, sub: string | null): Promise<void>;
  /** The Google account identifier of the user, or null when none is linked. */
  googleSubOf(id: number): Promise<string | null>;
  /** When each user's account was created, by user id. */
  createdAtByUser(): Promise<Map<number, string>>;
  /** False for a user who joined by invitation and has not yet confirmed their name and handle. */
  isWelcomed(id: number): Promise<boolean>;
  /** Stores the name the user confirmed and marks them as welcomed. */
  completeWelcome(id: number, name: string, at: string): Promise<void>;
}
