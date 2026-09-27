import { query } from '../db/pool.js';
import { validateRequired, validateNumber } from '../validators/inputValidators.js';

export async function getMarketplaceListings(req, res, next) {
  try {
    const { crop_type, status, creator_id, district, state, limit = 50, offset = 0 } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (crop_type) {
      conditions.push(`LOWER(crop_type) LIKE $${idx++}`);
      values.push(`%${crop_type.toLowerCase()}%`);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }
    if (creator_id) {
      conditions.push(`creator_id = $${idx++}`);
      values.push(creator_id);
    }
    if (district) {
      conditions.push(`LOWER(district) = $${idx++}`);
      values.push(district.toLowerCase());
    }
    if (state) {
      conditions.push(`LOWER(state) = $${idx++}`);
      values.push(state.toLowerCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Number(limit));
    const limitParam = `$${idx++}`;
    values.push(Number(offset));
    const offsetParam = `$${idx++}`;

    const sql = `
      SELECT * FROM marketplace_listings 
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

export async function getListingById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Listing ID is required'
      });
    }

    const result = await query(
      'SELECT * FROM marketplace_listings WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Marketplace listing with id "${id}" not found`
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

export async function createListing(req, res, next) {
  try {
    const body = req.body;
    const creatorId = body.creator_id || body.creatorId || body.userId;
    const cropType = body.crop_type || body.cropType || body.crop;
    const condition = body.condition || 'damaged';

    validateRequired({ creatorId, cropType, condition }, ['creatorId', 'cropType', 'condition']);
    const quantityKg = validateNumber(body.quantity_kg || body.quantityKg || body.quantity?.value, 'quantity_kg', { min: 0.1 });

    const id = body.id || `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const creatorRole = body.creator_role || body.creatorRole || 'farmer';
    const sourceAssessmentId = body.source_assessment_id || body.sourceAssessmentId || body.assessmentId || null;
    const title = body.title || `${cropType} Crop Waste`;
    const askingPrice = body.asking_price !== undefined ? Number(body.asking_price) : (body.expectedPrice || null);
    const status = body.status || 'listed';
    const location = body.location || body.readableLocation || null;
    const latitude = body.latitude || body.location?.latitude || null;
    const longitude = body.longitude || body.location?.longitude || null;
    const district = body.district || body.location?.district || null;
    const state = body.state || body.location?.state || null;
    const matchedBuyer = body.matched_buyer || null;
    const buyerType = body.buyer_type || null;
    const farmerName = body.farmer_name || body.farmerName || 'Agro Farmer';
    const contactPhone = body.contact_phone || body.phone || null;
    const imageUrl = body.image_url || body.selectedImage || null;

    // Ensure user exists first
    await query(
      `INSERT INTO users (user_id, display_name, phone) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO NOTHING`,
      [creatorId, farmerName, contactPhone]
    );

    const result = await query(
      `INSERT INTO marketplace_listings (
        id, creator_id, creator_role, source_assessment_id, title,
        crop_type, quantity_kg, condition, asking_price, status,
        location, latitude, longitude, district, state,
        matched_buyer, buyer_type, farmer_name, contact_phone, image_url,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        crop_type = EXCLUDED.crop_type,
        quantity_kg = EXCLUDED.quantity_kg,
        condition = EXCLUDED.condition,
        asking_price = EXCLUDED.asking_price,
        status = EXCLUDED.status,
        location = EXCLUDED.location,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        district = EXCLUDED.district,
        state = EXCLUDED.state,
        matched_buyer = EXCLUDED.matched_buyer,
        buyer_type = EXCLUDED.buyer_type,
        farmer_name = EXCLUDED.farmer_name,
        contact_phone = EXCLUDED.contact_phone,
        image_url = EXCLUDED.image_url,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        id, creatorId, creatorRole, sourceAssessmentId, title,
        cropType, quantityKg, condition, askingPrice, status,
        location, latitude, longitude, district, state,
        matchedBuyer, buyerType, farmerName, contactPhone, imageUrl
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

export async function updateListing(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Listing ID is required'
      });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.asking_price !== undefined) {
      fields.push(`asking_price = $${idx++}`);
      values.push(Number(updates.asking_price));
    }
    if (updates.quantity_kg !== undefined) {
      fields.push(`quantity_kg = $${idx++}`);
      values.push(Number(updates.quantity_kg));
    }
    if (updates.matched_buyer !== undefined) {
      fields.push(`matched_buyer = $${idx++}`);
      values.push(updates.matched_buyer);
    }
    if (updates.buyer_type !== undefined) {
      fields.push(`buyer_type = $${idx++}`);
      values.push(updates.buyer_type);
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

    const sql = `UPDATE marketplace_listings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Listing with id "${id}" not found`
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

export async function deleteListing(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Listing ID is required'
      });
    }

    const result = await query('DELETE FROM marketplace_listings WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Listing with id "${id}" not found`
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Listing "${id}" deleted successfully`
    });
  } catch (err) {
    next(err);
  }
}
