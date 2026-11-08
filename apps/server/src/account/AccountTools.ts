import type { DatabaseSync } from 'node:sqlite';
import type { AccountDeletionService } from './AccountDeletionService.js';
import type { AccountExporter } from './AccountExporter.js';

/** The account services over a data directory opened for the command line; close `db` when done. */
export interface AccountTools {
  db: DatabaseSync;
  exporter: AccountExporter;
  deletion: AccountDeletionService;
}
