import pg from 'pg';
import type { Logger } from '../../notify/Logger.js';
import type { JellystatConfig } from '../JellystatConfig.js';

/**
 * Opens a small connection pool on the Jellystat database. The caller ends it. Errors on idle
 * connections, such as Jellystat's Postgres restarting, are logged instead of crashing the process.
 */
export function openJellystatPool(config: JellystatConfig, logger: Logger): pg.Pool {
  const pool = new pg.Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    max: 2,
    options: '-c default_transaction_read_only=on',
  });
  pool.on('error', (error) => {
    logger.error(`Jellystat connection error: ${error.message}`);
  });
  return pool;
}
