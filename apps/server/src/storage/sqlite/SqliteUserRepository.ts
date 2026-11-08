import type { DatabaseSync } from 'node:sqlite';
import type { User, UserRole } from '@metrack/domain';
import type { NewUser } from '../repositories/NewUser.js';
import type { UserRepository } from '../repositories/UserRepository.js';
import { userFromRow } from '../mapping/userFromRow.js';

export class SqliteUserRepository implements UserRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(user: NewUser): Promise<User> {
    const result = this.db
      .prepare('INSERT INTO user (name, email, created_at) VALUES (?, ?, ?)')
      .run(user.name, user.email, this.now().toISOString());
    const created = await this.get(Number(result.lastInsertRowid));
    if (!created) throw new Error('The new user was not stored');
    return created;
  }

  async get(id: number): Promise<User | undefined> {
    const row = this.db.prepare('SELECT * FROM user WHERE id = ?').get(id);
    return row ? userFromRow(row) : undefined;
  }

  async list(): Promise<User[]> {
    return this.db.prepare('SELECT * FROM user ORDER BY id').all().map(userFromRow);
  }

  async setRole(id: number, role: UserRole): Promise<void> {
    this.db.prepare('UPDATE user SET role = ? WHERE id = ?').run(role, id);
  }
}
