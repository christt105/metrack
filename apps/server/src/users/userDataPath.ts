import { join } from 'node:path';
import { OWNER_ID } from './OWNER_ID.js';

/** Where a user's job state lives in the data directory. The owner keeps the paths used before there were users. */
export function userDataPath(dataDir: string, userId: number, name: string): string {
  return userId === OWNER_ID ? join(dataDir, name) : join(dataDir, 'users', String(userId), name);
}
