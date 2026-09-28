import { query, closePool } from "./backend/src/db/pool.js";

async function runAudit() {
  try {
    console.log("=== TABLE SIZES & ROW COUNTS ===");
    const tableSizes = await query(`
      SELECT 
        table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size,
        pg_total_relation_size(quote_ident(table_name)) as raw_bytes
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY raw_bytes DESC;
    `);
    for (const row of tableSizes.rows) {
      try {
        const countRes = await query(`SELECT COUNT(*) FROM ${row.table_name}`);
        console.log(`- ${row.table_name}: ${row.total_size} (${countRes.rows[0].count} rows)`);
      } catch (e) {
        console.log(`- ${row.table_name}: ${row.total_size} (error counting)`);
      }
    }

    console.log("\n=== COLUMN AVERAGE AND MAX LENGTHS (FOR LARGE DATA/IMAGES) ===");
    
    // Check marketplace_listings
    try {
      const mlCheck = await query(`
        SELECT 
          COUNT(*) as count,
          AVG(LENGTH(image_url::text)) as avg_image_len,
          MAX(LENGTH(image_url::text)) as max_image_len,
          SUM(LENGTH(image_url::text)) as total_image_bytes
        FROM marketplace_listings;
      `);
      console.log("marketplace_listings image_url bytes:", mlCheck.rows[0]);
    } catch (e) { console.log("marketplace_listings:", e.message); }

    // Check field_assessments
    try {
      const faCheck = await query(`
        SELECT 
          COUNT(*) as count,
          AVG(LENGTH(photo_url::text)) as avg_photo_len,
          MAX(LENGTH(photo_url::text)) as max_photo_len,
          SUM(LENGTH(photo_url::text)) as total_photo_bytes,
          AVG(LENGTH(analysis_result::text)) as avg_analysis_len,
          MAX(LENGTH(analysis_result::text)) as max_analysis_len,
          SUM(LENGTH(analysis_result::text)) as total_analysis_bytes
        FROM field_assessments;
      `);
      console.log("field_assessments:", faCheck.rows[0]);
    } catch (e) { console.log("field_assessments:", e.message); }

    // Check claim_dossiers
    try {
      const cdCheck = await query(`
        SELECT 
          COUNT(*) as count,
          AVG(LENGTH(evidence_photos::text)) as avg_evidence_len,
          MAX(LENGTH(evidence_photos::text)) as max_evidence_len,
          SUM(LENGTH(evidence_photos::text)) as total_evidence_bytes
        FROM claim_dossiers;
      `);
      console.log("claim_dossiers evidence_photos bytes:", cdCheck.rows[0]);
    } catch (e) { console.log("claim_dossiers:", e.message); }

    // Check sync_events
    try {
      const seCheck = await query(`
        SELECT 
          COUNT(*) as count,
          AVG(LENGTH(payload::text)) as avg_payload_len,
          MAX(LENGTH(payload::text)) as max_payload_len,
          SUM(LENGTH(payload::text)) as total_payload_bytes
        FROM sync_events;
      `);
      console.log("sync_events payload bytes:", seCheck.rows[0]);
    } catch (e) { console.log("sync_events:", e.message); }

    // Check agroconnect_posts
    try {
      const apCheck = await query(`
        SELECT 
          COUNT(*) as count,
          AVG(LENGTH(image_url::text)) as avg_img_len,
          MAX(LENGTH(image_url::text)) as max_img_len,
          SUM(LENGTH(image_url::text)) as total_img_bytes
        FROM agroconnect_posts;
      `);
      console.log("agroconnect_posts:", apCheck.rows[0]);
    } catch (e) { console.log("agroconnect_posts:", e.message); }

    // Check procurement_orders
    try {
      const poCheck = await query(`
        SELECT 
          COUNT(*) as count,
          AVG(LENGTH(procurement_summary::text)) as avg_summary_len,
          MAX(LENGTH(procurement_summary::text)) as max_summary_len,
          SUM(LENGTH(procurement_summary::text)) as total_summary_bytes
        FROM procurement_orders;
      `);
      console.log("procurement_orders:", poCheck.rows[0]);
    } catch (e) { console.log("procurement_orders:", e.message); }

    // Check logistics_gps_traces / logistics tables
    try {
      const gpsCheck = await query(`
        SELECT 
          COUNT(*) as count
        FROM logistics_gps_traces;
      `);
      console.log("logistics_gps_traces count:", gpsCheck.rows[0]);
    } catch (e) { console.log("logistics_gps_traces:", e.message); }

    // Check pg_stat_statements or query activity if available
    try {
      const statCheck = await query(`
        SELECT query, calls, total_exec_time, mean_exec_time, rows
        FROM pg_stat_statements
        ORDER BY calls DESC
        LIMIT 10;
      `);
      console.log("\n=== TOP 10 FREQUENT QUERIES (pg_stat_statements) ===");
      console.log(statCheck.rows);
    } catch (e) {
      console.log("\npg_stat_statements not enabled or accessible:", e.message);
    }

  } catch (err) {
    console.error("Audit error:", err);
  } finally {
    await closePool();
  }
}

runAudit();
