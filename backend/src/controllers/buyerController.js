import { query } from '../db/pool.js';
import { validateRequired, validateNumber } from '../validators/inputValidators.js';

export async function getBuyerRequirements(req, res, next) {
  try {
    const { crop, district, state, buyer_id, status = 'active', limit = 50, offset = 0 } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (crop) {
      conditions.push(`LOWER(crop) LIKE $${idx++}`);
      values.push(`%${crop.toLowerCase()}%`);
    }
    if (district) {
      conditions.push(`LOWER(district) = $${idx++}`);
      values.push(district.toLowerCase());
    }
    if (state) {
      conditions.push(`LOWER(state) = $${idx++}`);
      values.push(state.toLowerCase());
    }
    if (buyer_id) {
      conditions.push(`buyer_id = $${idx++}`);
      values.push(buyer_id);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Number(limit));
    const limitParam = `$${idx++}`;
    values.push(Number(offset));
    const offsetParam = `$${idx++}`;

    const sql = `
      SELECT * FROM buyer_requirements 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ${limitParam} OFFSET ${offsetParam}
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

export async function getBuyerRequirementById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Requirement ID is required'
      });
    }

    const result = await query(
      'SELECT * FROM buyer_requirements WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Buyer requirement with id "${id}" not found`
      });
    }

    res.status(200).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

export async function createBuyerRequirement(req, res, next) {
  try {
    const body = req.body;
    const buyerId = body.buyer_id || body.buyerId;
    const businessName = body.business_name || body.businessName || 'Verified Buyer';
    const crop = body.crop || body.cropName;

    validateRequired({ buyerId, businessName, crop }, ['buyerId', 'businessName', 'crop']);
    const quantityRequired = validateNumber(body.quantity_required || body.quantityRequired || body.quantity, 'quantity_required', { min: 1 });

    const id = body.id || `br_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const businessType = body.business_type || body.businessType || 'Processing Unit';
    const variety = body.variety || 'Commercial Grade';
    const unit = body.unit || 'kg';
    const targetPrice = body.target_price !== undefined ? Number(body.target_price) : (body.targetPrice || null);
    const buyingRadiusKm = Number(body.buying_radius_km || body.buyingRadiusKm || 50);
    const city = body.city || body.location?.city || null;
    const district = body.district || body.location?.district || null;
    const state = body.state || body.location?.state || null;
    const latitude = body.latitude || body.location?.latitude || null;
    const longitude = body.longitude || body.location?.longitude || null;
    const contactPerson = body.contact_person || body.contactInformation?.contactPerson || null;
    const phone = body.phone || body.contactInformation?.phone || null;
    const email = body.email || body.contactInformation?.email || null;
    const verificationStatus = body.verification_status || body.verificationStatus || 'verified';
    const status = body.status || 'active';

    // Ensure user exists first
    await query(
      `INSERT INTO users (user_id, display_name, phone, active_role, roles) 
       VALUES ($1, $2, $3, 'buyer', '{"buyer"}') 
       ON CONFLICT (user_id) DO NOTHING`,
      [buyerId, businessName, phone]
    );

    const result = await query(
      `INSERT INTO buyer_requirements (
        id, buyer_id, business_name, business_type, crop,
        variety, quantity_required, unit, target_price, buying_radius_km,
        city, district, state, latitude, longitude,
        contact_person, phone, email, verification_status, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        business_name = EXCLUDED.business_name,
        business_type = EXCLUDED.business_type,
        crop = EXCLUDED.crop,
        variety = EXCLUDED.variety,
        quantity_required = EXCLUDED.quantity_required,
        unit = EXCLUDED.unit,
        target_price = EXCLUDED.target_price,
        buying_radius_km = EXCLUDED.buying_radius_km,
        city = EXCLUDED.city,
        district = EXCLUDED.district,
        state = EXCLUDED.state,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        contact_person = EXCLUDED.contact_person,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        verification_status = EXCLUDED.verification_status,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        id, buyerId, businessName, businessType, crop,
        variety, quantityRequired, unit, targetPrice, buyingRadiusKm,
        city, district, state, latitude, longitude,
        contactPerson, phone, email, verificationStatus, status
      ]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

export async function updateBuyerRequirement(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Requirement ID is required'
      });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.target_price !== undefined || updates.targetPrice !== undefined) {
      fields.push(`target_price = $${idx++}`);
      values.push(Number(updates.target_price || updates.targetPrice));
    }
    if (updates.quantity_required !== undefined || updates.quantityRequired !== undefined) {
      fields.push(`quantity_required = $${idx++}`);
      values.push(Number(updates.quantity_required || updates.quantityRequired));
    }

    if (fields.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'No valid update fields provided'
      });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE buyer_requirements SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Buyer requirement with id "${id}" not found`
      });
    }

    res.status(200).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}
