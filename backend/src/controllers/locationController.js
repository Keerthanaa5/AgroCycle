import { query } from '../db/pool.js';
import { validateRequired, validateNumber } from '../validators/inputValidators.js';

export async function getUserLocations(req, res, next) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'userId is required'
      });
    }

    const result = await query(
      `SELECT * FROM farms_and_locations 
       WHERE user_id = $1 
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    res.status(200).json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserLocationByFarmId(req, res, next) {
  try {
    const { userId, farmId } = req.params;
    const cleanFarmId = farmId || 'default';

    const result = await query(
      `SELECT * FROM farms_and_locations 
       WHERE user_id = $1 AND farm_id = $2 
       LIMIT 1`,
      [userId, cleanFarmId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Farm location for user "${userId}" and farm "${cleanFarmId}" not found`
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

export async function saveLocation(req, res, next) {
  try {
    const body = req.body;
    const userId = body.user_id || body.userId;
    validateRequired({ userId }, ['userId']);

    const lat = validateNumber(body.latitude, 'latitude', { min: -90, max: 90 });
    const lon = validateNumber(body.longitude, 'longitude', { min: -180, max: 180 });
    const accuracy = Number(body.accuracy || 0);
    const farmId = body.farm_id || body.farmId || 'default';
    const farmName = body.farm_name || body.farmName || 'Main Farm';
    const id = body.id || `loc_${userId}_${farmId}`;
    const source = body.source || 'device-gps';
    const city = body.city || null;
    const district = body.district || null;
    const state = body.state || null;
    const country = body.country || 'India';
    const isDefault = body.is_default !== undefined ? Boolean(body.is_default) : (farmId === 'default');

    // Ensure user exists first before inserting foreign key
    await query(
      `INSERT INTO users (user_id, display_name) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, body.farmer_name || body.display_name || 'Agro Farmer']
    );

    const result = await query(
      `INSERT INTO farms_and_locations (
        id, user_id, farm_id, farm_name, latitude, longitude,
        accuracy, source, city, district, state, country, is_default,
        captured_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        farm_name = EXCLUDED.farm_name,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        accuracy = EXCLUDED.accuracy,
        source = EXCLUDED.source,
        city = EXCLUDED.city,
        district = EXCLUDED.district,
        state = EXCLUDED.state,
        country = EXCLUDED.country,
        is_default = EXCLUDED.is_default,
        captured_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [id, userId, farmId, farmName, lat, lon, accuracy, source, city, district, state, country, isDefault]
    );

    res.status(200).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}
