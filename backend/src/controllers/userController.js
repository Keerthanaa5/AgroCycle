import { query } from '../db/pool.js';
import { validateRequired } from '../validators/inputValidators.js';

export async function getUserById(req, res, next) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'userId parameter is required'
      });
    }

    const result = await query(
      'SELECT * FROM users WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `User with id "${userId}" not found`
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

export async function upsertUser(req, res, next) {
  try {
    const body = req.body;
    const userId = body.user_id || body.userId;

    if (!userId) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'user_id or userId is required'
      });
    }

    const displayName = body.display_name || body.name || 'Agro Farmer';
    const phone = body.phone || null;
    const roles = Array.isArray(body.roles) ? body.roles : [body.role || body.active_role || 'farmer'];
    const activeRole = body.active_role || body.activeRole || roles[0] || 'farmer';
    const verificationStatus = body.verification_status || body.verificationStatus || 'pending';
    const language = body.language || 'english';
    const aadharNumber = body.aadhar_number || body.aadharNumber || null;
    const dateOfBirth = body.date_of_birth || body.dateOfBirth || null;

    const result = await query(
      `INSERT INTO users (
        user_id, display_name, phone, roles, active_role,
        verification_status, language, aadhar_number, date_of_birth, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        phone = COALESCE(EXCLUDED.phone, users.phone),
        roles = COALESCE(EXCLUDED.roles, users.roles),
        active_role = COALESCE(EXCLUDED.active_role, users.active_role),
        verification_status = COALESCE(EXCLUDED.verification_status, users.verification_status),
        language = COALESCE(EXCLUDED.language, users.language),
        aadhar_number = COALESCE(EXCLUDED.aadhar_number, users.aadhar_number),
        date_of_birth = COALESCE(EXCLUDED.date_of_birth, users.date_of_birth),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [userId, displayName, phone, roles, activeRole, verificationStatus, language, aadharNumber, dateOfBirth]
    );

    res.status(200).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const { userId } = req.params;
    const updates = req.body;

    if (!userId) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'userId parameter is required'
      });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    const displayName = updates.display_name ?? updates.displayName;
    const phone = updates.phone;
    const activeRole = updates.active_role ?? updates.activeRole;
    const roles = updates.roles;
    const verificationStatus = updates.verification_status ?? updates.verificationStatus;
    const language = updates.language;
    const aadharNumber = updates.aadhar_number ?? updates.aadharNumber;
    const dateOfBirth = updates.date_of_birth ?? updates.dateOfBirth;

    if (displayName !== undefined) {
      fields.push(`display_name = $${idx++}`);
      values.push(displayName);
    }
    if (phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(phone);
    }
    if (roles !== undefined) {
      fields.push(`roles = $${idx++}`);
      values.push(Array.isArray(roles) ? roles : [roles]);
    }
    if (activeRole !== undefined) {
      fields.push(`active_role = $${idx++}`);
      values.push(activeRole);
    }
    if (verificationStatus !== undefined) {
      fields.push(`verification_status = $${idx++}`);
      values.push(verificationStatus);
    }
    if (language !== undefined) {
      fields.push(`language = $${idx++}`);
      values.push(language);
    }
    if (aadharNumber !== undefined) {
      fields.push(`aadhar_number = $${idx++}`);
      values.push(aadharNumber);
    }
    if (dateOfBirth !== undefined) {
      fields.push(`date_of_birth = $${idx++}`);
      values.push(dateOfBirth);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'No valid update fields provided'
      });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`;
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `User with id "${userId}" not found`
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
