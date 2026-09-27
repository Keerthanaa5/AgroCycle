import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

let pool = null;

/**
 * Returns the active PostgreSQL connection pool instance.
 * Reuses the singleton instance across application requests.
 */
export function getPool() {
  if (pool) return pool;

  if (!config.databaseUrl) {
    return null;
  }

  const poolConfig = {
    connectionString: config.databaseUrl,
    min: config.dbPoolMin,
    max: config.dbPoolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  if (config.dbSsl) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]', err.message);
  });

  return pool;
}

/**
 * Executes a parameterized SQL query safely through the connection pool.
 *
 * @param {string} text - Parameterized SQL statement
 * @param {Array} [params] - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  const activePool = getPool();
  if (!activePool) {
    throw new Error('DATABASE_NOT_CONFIGURED: DATABASE_URL is not configured.');
  }

  const start = Date.now();
  try {
    const res = await activePool.query(text, params);
    const duration = Date.now() - start;
    if (!config.isProduction && process.env.DEBUG_SQL === 'true') {
      console.log(`[SQL Query] Duration: ${duration}ms, Rows: ${res.rowCount}`);
    }
    return res;
  } catch (err) {
    console.error('[PostgreSQL Query Error]', err.message);
    throw err;
  }
}

/**
 * Gracefully shuts down the PostgreSQL connection pool.
 */
export async function closePool() {
  if (pool) {
    console.log('[PostgreSQL] Closing connection pool...');
    try {
      await pool.end();
    } catch (err) {
      console.error('[PostgreSQL Error closing pool]', err.message);
    } finally {
      pool = null;
    }
  }
}
