import { Router } from 'express';
import { getPool, query } from '../db/pool.js';
import { config } from '../config/env.js';

const router = Router();

/**
 * Basic service health check
 */
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'agrocycle-backend',
    timestamp: new Date().toISOString()
  });
});

/**
 * Database connectivity health check
 */
router.get('/health/db', async (_req, res) => {
  if (!config.databaseUrl) {
    return res.status(503).json({
      status: 'unavailable',
      service: 'agrocycle-database',
      database: 'postgresql',
      connected: false,
      message: 'Database is not configured (DATABASE_URL missing).'
    });
  }

  const pool = getPool();
  if (!pool) {
    return res.status(503).json({
      status: 'error',
      service: 'agrocycle-database',
      database: 'postgresql',
      connected: false,
      message: 'Failed to initialize database connection pool.'
    });
  }

  try {
    const result = await query('SELECT 1 AS alive');
    if (result && result.rows && result.rows.length > 0) {
      return res.status(200).json({
        status: 'ok',
        service: 'agrocycle-database',
        database: 'postgresql',
        connected: true,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(503).json({
      status: 'error',
      service: 'agrocycle-database',
      database: 'postgresql',
      connected: false,
      message: 'Database query returned unexpected result.'
    });
  } catch (err) {
    // Controlled response without leaking host or credentials
    return res.status(503).json({
      status: 'error',
      service: 'agrocycle-database',
      database: 'postgresql',
      connected: false,
      message: 'Database connection failed.'
    });
  }
});

export default router;
