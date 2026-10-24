import type { Migration } from '../Migration.js';
import { initialMigration } from './0001-initial.js';
import { dataModelMigration } from './0002-data-model.js';

export const migrations: readonly Migration[] = [initialMigration, dataModelMigration];
