import { query } from '../db/pool.js';
import { validateRequired, validateNumber } from '../validators/inputValidators.js';

/**
 * Get silage centers
 */
export async function getSilageCenters(req, res, next) {
  try {
    const { district, state, status = 'operational', limit = 50 } = req.query;
    const conditions = [];
    const values = [];
    let idx = 1;

    if (district) {
      conditions.push(`LOWER(district) = $${idx++}`);
      values.push(district.toLowerCase());
    }
    if (state) {
      conditions.push(`LOWER(state) = $${idx++}`);
      values.push(state.toLowerCase());
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Number(limit));

    const sql = `
      SELECT * FROM silage_centers 
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
 * Get silage center by ID
 */
export async function getSilageCenterById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM silage_centers WHERE id = $1 LIMIT 1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Silage center "${id}" not found`
      });
    }
    res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Create silage center
 */
export async function createSilageCenter(req, res, next) {
  try {
    const body = req.body;
    const creatorId = body.creator_id || body.creatorId || body.userId;
    const name = body.name;
    const location = body.location;
    const pricePerKg = validateNumber(body.price_per_kg || body.pricePerKg || body.price, 'price_per_kg', { min: 0.1 });

    validateRequired({ creatorId, name, location }, ['creatorId', 'name', 'location']);

    const id = body.id || `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const creatorRole = body.creator_role || body.creatorRole || 'buyer';
    const district = body.district || null;
    const state = body.state || null;
    const latitude = body.latitude || null;
    const longitude = body.longitude || null;
    const capacityKg = Number(body.capacity_kg || body.capacityKg || 10000);
    const availableKg = Number(body.available_kg || body.availableKg || capacityKg);
    const contactPhone = body.contact_phone || body.phone || null;
    const status = body.status || 'operational';

    // Ensure creator user exists
    await query(
      `INSERT INTO users (user_id, display_name, phone) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO NOTHING`,
      [creatorId, body.creatorName || body.owner || 'Facility Operator', contactPhone]
    );

    const result = await query(
      `INSERT INTO silage_centers (
        id, creator_id, creator_role, name, location,
        district, state, latitude, longitude,
        capacity_kg, available_kg, price_per_kg, contact_phone, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        location = EXCLUDED.location,
        district = EXCLUDED.district,
        state = EXCLUDED.state,
        price_per_kg = EXCLUDED.price_per_kg,
        capacity_kg = EXCLUDED.capacity_kg,
        available_kg = EXCLUDED.available_kg,
        contact_phone = EXCLUDED.contact_phone,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        id, creatorId, creatorRole, name, location,
        district, state, latitude, longitude,
        capacityKg, availableKg, pricePerKg, contactPhone, status
      ]
    );

    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete silage center
 */
export async function deleteSilageCenter(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM silage_centers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Silage center "${id}" not found`
      });
    }
    res.status(200).json({ status: 'success', message: `Silage center "${id}" deleted` });
  } catch (err) {
    next(err);
  }
}

/**
 * Get silage bookings
 */
export async function getSilageBookings(req, res, next) {
  try {
    const { creator_id, center_id, status, limit = 50 } = req.query;
    const conditions = [];
    const values = [];
    let idx = 1;

    if (creator_id) {
      conditions.push(`creator_id = $${idx++}`);
      values.push(creator_id);
    }
    if (center_id) {
      conditions.push(`center_id = $${idx++}`);
      values.push(center_id);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Number(limit));

    const sql = `
      SELECT * FROM silage_bookings 
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
 * Create silage booking
 */
export async function createSilageBooking(req, res, next) {
  try {
    const body = req.body;
    const creatorId = body.creator_id || body.creatorId || body.userId;
    const cropType = body.crop_type || body.cropType;
    const quantityKg = validateNumber(body.quantity_kg || body.quantityKg, 'quantity_kg', { min: 1 });

    validateRequired({ creatorId, cropType }, ['creatorId', 'cropType']);

    const id = body.id || `sbk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const centerId = body.center_id || body.centerId || null;
    const pickupDate = body.pickup_date || body.pickupDate || new Date().toISOString().split('T')[0];
    const pricePerKg = Number(body.price_per_kg || body.pricePerKg || 0);
    const totalPrice = Number(body.total_price || body.totalPrice || (quantityKg * pricePerKg));
    const status = body.status || 'requested';
    const farmerName = body.farmer_name || body.farmerName || 'Farmer';
    const location = body.location || null;
    const contactPhone = body.contact_phone || body.farmer_phone || body.phone || null;

    // Ensure creator user exists
    await query(
      `INSERT INTO users (user_id, display_name, phone) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO NOTHING`,
      [creatorId, farmerName, contactPhone]
    );

    const result = await query(
      `INSERT INTO silage_bookings (
        id, creator_id, center_id, crop_type, quantity_kg,
        pickup_date, price_per_kg, total_price, status,
        farmer_name, location, contact_phone,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        crop_type = EXCLUDED.crop_type,
        quantity_kg = EXCLUDED.quantity_kg,
        pickup_date = EXCLUDED.pickup_date,
        price_per_kg = EXCLUDED.price_per_kg,
        total_price = EXCLUDED.total_price,
        status = EXCLUDED.status,
        farmer_name = EXCLUDED.farmer_name,
        location = EXCLUDED.location,
        contact_phone = EXCLUDED.contact_phone,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        id, creatorId, centerId, cropType, quantityKg,
        pickupDate, pricePerKg, totalPrice, status,
        farmerName, location, contactPhone
      ]
    );

    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Update silage booking status
 */
export async function updateSilageBookingStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    validateRequired({ id, status }, ['id', 'status']);

    const validStatuses = ['requested', 'confirmed', 'picked_up', 'processed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: `Invalid status "${status}". Allowed: ${validStatuses.join(', ')}`
      });
    }

    const result = await query(
      `UPDATE silage_bookings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Silage booking "${id}" not found`
      });
    }

    res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
