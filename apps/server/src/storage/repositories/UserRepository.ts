import type { User } from '@metrack/domain';
import type { NewUser } from './NewUser.js';

export interface UserRepository {
  create(user: NewUser): Promise<User>;
  get(id: number): Promise<User | undefined>;
  /** Ordered by id. */
  list(): Promise<User[]>;
}
