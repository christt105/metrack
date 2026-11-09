import type { User, UserRole } from '@metrack/domain';
import { userFromRow } from '../mapping/userFromRow.js';
import type { NewUser } from '../repositories/NewUser.js';
import type { UserRepository } from '../repositories/UserRepository.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll, queryFirst } from './d1Query.js';

export class D1UserRepository implements UserRepository {
  constructor(
    private readonly db: D1Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(user: NewUser): Promise<User> {
    const meta = await execute(
      this.db,
      'INSERT INTO user (name, email, created_at) VALUES (?, ?, ?)',
      user.name,
      user.email,
      this.now().toISOString(),
    );
    const created = await this.get(meta.last_row_id);
    if (!created) throw new Error('The new user was not stored');
    return created;
  }

  async get(id: number): Promise<User | undefined> {
    const row = await queryFirst(this.db, 'SELECT * FROM user WHERE id = ?', id);
    return row ? userFromRow(row) : undefined;
  }

  /** Reads every account; cache it or keep it to admin screens (nr8fn1). */
  async list(): Promise<User[]> {
    return (await queryAll(this.db, 'SELECT * FROM user ORDER BY id')).map(userFromRow);
  }

  async setRole(id: number, role: UserRole): Promise<void> {
    await execute(this.db, 'UPDATE user SET role = ? WHERE id = ?', role, id);
  }
}
