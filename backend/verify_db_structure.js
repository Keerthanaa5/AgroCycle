import { query, closePool } from './src/db/pool.js';

async function verify() {
  try {
    console.log('\n--- VERIFYING POSTGRESQL TABLES ---');
    const tablesRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name ASC;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables in public schema:`, tables.join(', '));

    console.log('\n--- VERIFYING FOREIGN KEYS ---');
    const fkRes = await query(`
      SELECT
        tc.table_name AS from_table,
        kcu.column_name AS from_column,
        ccu.table_name AS to_table,
        ccu.column_name AS to_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    console.log(`Found ${fkRes.rows.length} foreign key constraints:`);
    for (const fk of fkRes.rows) {
      console.log(`  ${fk.from_table}.${fk.from_column} -> ${fk.to_table}.${fk.to_column}`);
    }

    console.log('\n--- VERIFYING INDEXES ---');
    const indexRes = await query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `);
    console.log(`Found ${indexRes.rows.length} secondary indexes:`);
    for (const idx of indexRes.rows) {
      console.log(`  [${idx.tablename}] ${idx.indexname}`);
    }

    console.log('\n>>> POSTGRESQL STRUCTURE VERIFIED SUCCESSFULLY! <<<');
  } catch (err) {
    console.error('Verification error:', err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

verify();
