import { query, closePool } from './pool.js';

async function cleanup() {
  try {
    await query("DELETE FROM sync_events WHERE user_id LIKE 'test_%'");
    await query("DELETE FROM marketplace_listings WHERE creator_id LIKE 'test_%'");
    await query("DELETE FROM field_assessments WHERE user_id LIKE 'test_%'");
    await query("DELETE FROM buyer_requirements WHERE buyer_id LIKE 'test_%'");
    await query("DELETE FROM farms_and_locations WHERE user_id LIKE 'test_%'");
    await query("DELETE FROM users WHERE user_id LIKE 'test_%'");
    console.log('[DB Clean] Successfully cleared all test fixtures.');
  } catch (err) {
    console.error('[DB Clean Error]:', err);
  } finally {
    await closePool();
  }
}

cleanup();
