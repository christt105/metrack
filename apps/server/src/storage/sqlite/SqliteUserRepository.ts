import type { DatabaseSync } from 'node:sqlite';
import type { User, UserRole } from '@metrack/domain';
import type { NewUser } from '../repositories/NewUser.js';
import type { UserRepository } from '../repositories/UserRepository.js';
import { userFromRow } from '../mapping/userFromRow.js';
import { text } from '../mapping/rowMapping.js';

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

  async findByGoogleSub(sub: string): Promise<User | undefined> {
    const row = this.db.prepare('SELECT * FROM user WHERE google_sub = ?').get(sub);
    return row ? userFromRow(row) : undefined;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const row = this.db.prepare('SELECT * FROM user WHERE email = ?').get(email);
    return row ? userFromRow(row) : undefined;
  }

  async linkGoogleSub(id: number, sub: string): Promise<boolean> {
    const result = this.db
      .prepare('UPDATE user SET google_sub = ? WHERE id = ? AND google_sub IS NULL')
      .run(sub, id);
    return Number(result.changes) > 0;
  }

  async setGoogleSub(id: number, sub: string | null): Promise<void> {
    this.db.prepare('UPDATE user SET google_sub = ? WHERE id = ?').run(sub, id);
  }

  async googleSubOf(id: number): Promise<string | null> {
    const row = this.db.prepare('SELECT google_sub FROM user WHERE id = ?').get(id);
    return text(row?.google_sub);
  }
}
