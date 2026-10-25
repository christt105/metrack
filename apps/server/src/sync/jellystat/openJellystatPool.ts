import pg from 'pg';
import type { JellystatConfig } from '../JellystatConfig.js';

/** Opens a small connection pool on the Jellystat database. The caller ends it. */
export function openJellystatPool(config: JellystatConfig): pg.Pool {
  return new pg.Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    max: 2,
    options: '-c default_transaction_read_only=on',
  });
}
