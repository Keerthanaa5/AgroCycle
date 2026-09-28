import pg from './backend/node_modules/pg/lib/index.js';
import dotenv from './backend/node_modules/dotenv/lib/main.js';

dotenv.config({ path: './backend/.env' });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function testFK() {
  try {
    const res = await pool.query(
      'INSERT INTO marketplace_listings (id, creator_id, crop_type, quantity_kg, condition, source_assessment_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      ['test_fk_123', 'usr_farmer_ramesh_01', 'Tomato', 100, 'damaged', 'non_existent_assessment_id_999']
    );
    console.log('Success:', res.rows[0]);
    await pool.query('DELETE FROM marketplace_listings WHERE id = $1', ['test_fk_123']);
  } catch (err) {
    console.error('CAUGHT DB ERROR:');
    console.error('  Message:', err.message);
    console.error('  Code:', err.code);
    console.error('  Detail:', err.detail);
    console.error('  Constraint:', err.constraint);
  } finally {
    await pool.end();
  }
}

testFK();
