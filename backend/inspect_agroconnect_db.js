import { query, getPool } from './src/db/pool.js';

async function main() {
  try {
    const constraints = await query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'agroconnect_posts'::regclass;
    `);
    console.log('Constraints on agroconnect_posts:');
    console.table(constraints.rows);
  } catch (e) {
    console.error('Error querying DB:', e);
  } finally {
    const p = getPool();
    if (p) await p.end();
  }
}

main();
