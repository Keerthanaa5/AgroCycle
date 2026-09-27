import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from './pool.js';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, 'migrations');

async function checkStatus() {
  if (!config.databaseUrl) {
    console.error('[DB Status] DATABASE_URL is not configured.');
    process.exit(1);
  }

  const pool = getPool();
  if (!pool) {
    console.error('[DB Status] Failed to initialize connection pool.');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    // Check if migrations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'schema_migrations'
      );
    `);

    let appliedMap = new Map();
    if (tableCheck.rows[0].exists) {
      const appliedResult = await client.query(
        'SELECT migration_name, applied_at FROM schema_migrations ORDER BY id ASC'
      );
      for (const row of appliedResult.rows) {
        appliedMap.set(row.migration_name, row.applied_at);
      }
    }

    const files = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
      : [];

    console.log('\n=== PostgreSQL Migration Status ===');
    console.log('--------------------------------------------------');
    for (const file of files) {
      if (appliedMap.has(file)) {
        const appliedAt = appliedMap.get(file);
        console.log(`[APPLIED]  ${file} (at ${new Date(appliedAt).toISOString()})`);
      } else {
        console.log(`[PENDING]  ${file}`);
      }
    }
    console.log('--------------------------------------------------\n');
  } catch (err) {
    console.error('[DB Status Error]', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await closePool();
  }
}

checkStatus();
