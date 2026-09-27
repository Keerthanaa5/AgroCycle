import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from './pool.js';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, 'migrations');

async function runMigrations() {
  if (!config.databaseUrl) {
    console.error('[Migration Error] DATABASE_URL is not configured. Aborting.');
    process.exit(1);
  }

  const pool = getPool();
  if (!pool) {
    console.error('[Migration Error] Failed to initialize connection pool.');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    console.log('[Migration] Checking migration tracking table...');

    // 1. Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch already applied migrations
    const appliedResult = await client.query(
      'SELECT migration_name FROM schema_migrations ORDER BY id ASC'
    );
    const appliedSet = new Set(appliedResult.rows.map((r) => r.migration_name));

    // 3. Read migration files from directory
    if (!fs.existsSync(migrationsDir)) {
      console.log('[Migration] No migrations directory found.');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[Migration] Already applied: ${file}`);
        continue;
      }

      console.log(`[Migration] Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Execute migration inside a transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`[Migration] Successfully applied: ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migration Failed] Error executing ${file}:`, err.message);
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log('[Migration] Database schema is already up to date.');
    } else {
      console.log(`[Migration] Successfully applied ${appliedCount} new migration(s).`);
    }
  } catch (err) {
    console.error('[Migration Error]', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await closePool();
  }
}

runMigrations();
