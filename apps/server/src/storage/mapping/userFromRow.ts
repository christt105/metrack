import type { User, UserRole } from '@metrack/domain';
import type { Row } from './Row.js';
import { text } from './rowMapping.js';

export function userFromRow(row: Row): User {
  return {
    id: Number(row.id),
    name: String(row.name),
    email: text(row.email),
    role: String(row.role) as UserRole,
  };
}
