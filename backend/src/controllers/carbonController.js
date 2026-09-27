import { query } from '../db/pool.js';
import { validateRequired, validateNumber } from '../validators/inputValidators.js';

/**
 * Get carbon activities
 */
export async function getCarbonActivities(req, res, next) {
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
      SELECT * FROM carbon_activities 
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
 * Get carbon activity by ID with offers
 */
export async function getCarbonActivityById(req, res, next) {
  try {
    const { id } = req.params;
    const activityResult = await query('SELECT * FROM carbon_activities WHERE id = $1 LIMIT 1', [id]);

    if (activityResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Carbon activity "${id}" not found`
      });
    }

    const offersResult = await query(
      'SELECT * FROM carbon_offers WHERE activity_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.status(200).json({
      status: 'success',
      data: {
        ...activityResult.rows[0],
        offers: offersResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create carbon activity (Farmer logs activity)
 */
export async function createCarbonActivity(req, res, next) {
  try {
    const body = req.body;
    const creatorId = body.creator_id || body.creatorId || body.userId;
    const activityType = body.activity_type || body.activityType;
    const areaAcres = validateNumber(body.area_acres || body.areaAcres, 'area_acres', { min: 0.01 });

    validateRequired({ creatorId, activityType }, ['creatorId', 'activityType']);

    const id = body.id || `ca_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const creatorRole = body.creator_role || body.creatorRole || 'farmer';
    const description = body.description || null;
    const co2SavedKg = Number(body.co2_saved_kg || body.co2Saved || (areaAcres * 850));
    const creditsEarned = Number(body.credits_earned || body.credits || (co2SavedKg / 1000));
    const creditValueInr = Number(body.credit_value_inr || body.value || (creditsEarned * 500));
    const status = body.status || 'pending';
    const farmerName = body.farmer_name || body.farmerName || 'Farmer';
    const proofImageUrl = body.proof_image_url || body.image || null;

    // Ensure user exists
    await query(
      `INSERT INTO users (user_id, display_name, phone) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO NOTHING`,
      [creatorId, farmerName, body.phone || null]
    );

    const result = await query(
      `INSERT INTO carbon_activities (
        id, creator_id, creator_role, activity_type, description,
        area_acres, co2_saved_kg, credits_earned, credit_value_inr,
        status, proof_image_url, farmer_name,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        activity_type = EXCLUDED.activity_type,
        description = EXCLUDED.description,
        area_acres = EXCLUDED.area_acres,
        co2_saved_kg = EXCLUDED.co2_saved_kg,
        credits_earned = EXCLUDED.credits_earned,
        credit_value_inr = EXCLUDED.credit_value_inr,
        farmer_name = EXCLUDED.farmer_name,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        id, creatorId, creatorRole, activityType, description,
        areaAcres, co2SavedKg, creditsEarned, creditValueInr,
        status, proofImageUrl, farmerName
      ]
    );

    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Submit sponsorship offer on a carbon activity (Buyer -> Farmer)
 * Strict Rule: Anti self-sponsorship
 */
export async function submitCarbonOffer(req, res, next) {
  try {
    const { id } = req.params; // activity id
    const body = req.body;
    const sponsorId = body.sponsor_id || body.sponsorId || body.userId;
    const offeredPriceInr = validateNumber(body.offered_price_inr || body.offeredPrice || body.value, 'offered_price_inr', { min: 1 });

    validateRequired({ sponsorId }, ['sponsorId']);

    // Check activity exists
    const actRes = await query('SELECT * FROM carbon_activities WHERE id = $1 LIMIT 1', [id]);
    if (actRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Carbon activity "${id}" not found`
      });
    }

    const activity = actRes.rows[0];

    // ANTI SELF-SPONSORSHIP RULE:
    if (activity.creator_id === sponsorId) {
      return res.status(400).json({
        status: 'error',
        code: 'SELF_SPONSORSHIP_FORBIDDEN',
        message: 'Anti-self-sponsorship rule: You cannot sponsor your own carbon activity.'
      });
    }

    // Ensure sponsor user exists
    await query(
      `INSERT INTO users (user_id, display_name, phone) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO NOTHING`,
      [sponsorId, body.sponsor_name || body.sponsorName || 'Commercial Sponsor', body.sponsor_phone || body.phone || null]
    );

    const offerId = body.offer_id || body.id || `co_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Insert offer
    const offerRes = await query(
      `INSERT INTO carbon_offers (
        id, activity_id, sponsor_id, offered_price_inr, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'offered', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        offered_price_inr = EXCLUDED.offered_price_inr,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [offerId, id, sponsorId, offeredPriceInr]
    );

    // Update activity status to offer_received & set sponsor_id
    await query(
      `UPDATE carbon_activities 
       SET status = 'offer_received', sponsor_id = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [sponsorId, id]
    );

    res.status(201).json({
      status: 'success',
      data: offerRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle farmer accept/reject on offer
 * Strict Rule: Only activity creator can accept/reject; cannot accept self-sponsorship
 */
export async function respondToCarbonOffer(req, res, next) {
  try {
    const { id, offerId } = req.params;
    const { action, userId } = req.body; // action: 'accept' | 'reject'

    validateRequired({ action, userId }, ['action', 'userId']);

    if (!['accept', 'reject', 'accepted', 'rejected'].includes(action.toLowerCase())) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Action must be "accept" or "reject"'
      });
    }

    const actRes = await query('SELECT * FROM carbon_activities WHERE id = $1 LIMIT 1', [id]);
    if (actRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Carbon activity "${id}" not found`
      });
    }

    const activity = actRes.rows[0];

    // OWNERSHIP RULE: Only the creator of the activity can accept or reject offers
    if (activity.creator_id !== userId) {
      return res.status(403).json({
        status: 'error',
        code: 'UNAUTHORIZED_ACTION',
        message: 'Only the creator farmer can accept or decline offers for this activity.'
      });
    }

    const isAccept = action.toLowerCase().startsWith('accept');

    if (isAccept) {
      // Update offer status
      await query(
        `UPDATE carbon_offers SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [offerId]
      );
      // Update activity status
      const updatedAct = await query(
        `UPDATE carbon_activities SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
      );
      return res.status(200).json({ status: 'success', data: updatedAct.rows[0], message: 'Offer accepted' });
    } else {
      // Reject offer
      await query(
        `UPDATE carbon_offers SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [offerId]
      );
      const updatedAct = await query(
        `UPDATE carbon_activities SET status = 'pending', sponsor_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
      );
      return res.status(200).json({ status: 'success', data: updatedAct.rows[0], message: 'Offer declined' });
    }
  } catch (err) {
    next(err);
  }
}
