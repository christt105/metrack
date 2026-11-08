import { migrations } from '../../src/storage/migrations/index.js';

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1]!.version;
