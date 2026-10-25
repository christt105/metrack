import type { Migration } from '../Migration.js';

export const initialMigration: Migration = {
  version: 1,
  name: 'initial',
  up: () => {},
};
