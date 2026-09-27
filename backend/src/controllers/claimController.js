import { query } from '../db/pool.js';
import { validateRequired, validateNumber } from '../validators/inputValidators.js';

/**
 * Get claim dossiers
 */
export async function getClaimDossiers(req, res, next) {
  try {
    const { creator_id, status, limit = 50 } = req.query;
    const conditions = [];
    const values = [];
    let idx = 1;

    if (creator_id) {
      conditions.push(`creator_id = $${idx++}`);
      values.push(creator_id);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Number(limit));

    const sql = `
      SELECT * FROM claim_dossiers 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT $${idx}
    `;

    const result = await query(sql, values);
    res.status(200).json({
      status: 'success',
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get claim dossier by ID
 */
export async function getClaimDossierById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM claim_dossiers WHERE id = $1 LIMIT 1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Claim dossier "${id}" not found`
      });
    }

    res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Create or save claim dossier
 */
export async function createClaimDossier(req, res, next) {
  try {
    const body = req.body;
    const creatorId = body.creator_id || body.creatorId || body.userId;
    const cropType = body.crop_type || body.cropType;
    const damageType = body.damage_type || body.damageType || 'other';

    validateRequired({ creatorId, cropType }, ['creatorId', 'cropType']);

    const id = body.id || `ic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const farmerId = body.farmer_id || body.farmerId || creatorId;
    const sourceAssessmentId = body.source_assessment_id || body.sourceAssessmentId || body.assessmentId || null;
    const farmerName = body.farmer_name || body.farmerName || 'Farmer';
    const mobileNumber = body.mobile_number || body.phone || '9876543210';
    const aadharNumber = body.aadhar_number || body.aadhar || 'N/A';
    const dateOfBirth = body.date_of_birth || body.dob || 'N/A';
    const damagePercentage = Number(body.damage_percentage || body.damagePercentage || 0);
    const areaAcres = Number(body.area_acres || body.areaAcres || 1);
    const estimatedLossInr = Number(body.estimated_loss_inr || body.estimatedLoss || 0);
    const claimAmountInr = Number(body.claim_amount_inr || body.claimAmount || estimatedLossInr);
    const status = body.status || 'draft';
    const damageImageUrl = body.damage_image_url || body.image || null;
    const location = body.location || null;
    const latitude = body.latitude || null;
    const longitude = body.longitude || null;
    const aiReport = typeof body.ai_report === 'object' ? JSON.stringify(body.ai_report) : (body.ai_report || body.evidenceReview ? JSON.stringify(body.evidenceReview) : null);

    // Ensure user exists
    await query(
      `INSERT INTO users (user_id, display_name, phone) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO NOTHING`,
      [creatorId, farmerName, mobileNumber]
    );

    const result = await query(
      `INSERT INTO claim_dossiers (
        id, creator_id, farmer_id, source_assessment_id,
        farmer_name, mobile_number, aadhar_number, date_of_birth,
        crop_type, damage_type, damage_percentage, area_acres,
        estimated_loss_inr, claim_amount_inr, status,
        damage_image_url, location, latitude, longitude, ai_report,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        crop_type = EXCLUDED.crop_type,
        damage_type = EXCLUDED.damage_type,
        damage_percentage = EXCLUDED.damage_percentage,
        area_acres = EXCLUDED.area_acres,
        estimated_loss_inr = EXCLUDED.estimated_loss_inr,
        claim_amount_inr = EXCLUDED.claim_amount_inr,
        status = EXCLUDED.status,
        damage_image_url = EXCLUDED.damage_image_url,
        location = EXCLUDED.location,
        ai_report = EXCLUDED.ai_report,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        id, creatorId, farmerId, sourceAssessmentId,
        farmerName, mobileNumber, aadharNumber, dateOfBirth,
        cropType, damageType, damagePercentage, areaAcres,
        estimatedLossInr, claimAmountInr, status,
        damageImageUrl, location, latitude, longitude, aiReport
      ]
    );

    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete claim dossier
 */
export async function deleteClaimDossier(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM claim_dossiers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Claim dossier "${id}" not found`
      });
    }
    res.status(200).json({ status: 'success', message: `Claim dossier "${id}" deleted` });
  } catch (err) {
    next(err);
  }
}
