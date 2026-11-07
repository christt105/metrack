import type { User, UserRole } from '@metrack/domain';
import type { NewUser } from './NewUser.js';

export interface UserRepository {
  create(user: NewUser): Promise<User>;
  get(id: number): Promise<User | undefined>;
  /** Ordered by id. */
  list(): Promise<User[]>;
  setRole(id: number, role: UserRole): Promise<void>;
}
