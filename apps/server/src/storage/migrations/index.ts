import type { Migration } from '../Migration.js';
import { initialMigration } from './0001-initial.js';

export const migrations: readonly Migration[] = [initialMigration];
