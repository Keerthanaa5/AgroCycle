import { query } from '../db/pool.js';
import { validateRequired } from '../validators/inputValidators.js';

/**
 * Get notifications for a user
 */
export async function getUserNotifications(req, res, next) {
  try {
    const { userId } = req.params;
    const { limit = 50, is_read } = req.query;

    validateRequired({ userId }, ['userId']);

    const conditions = ['user_id = $1'];
    const values = [userId];
    let idx = 2;

    if (is_read !== undefined) {
      conditions.push(`is_read = $${idx++}`);
      values.push(is_read === 'true');
    }

    values.push(Number(limit));

    const sql = `
      SELECT * FROM notifications 
      WHERE ${conditions.join(' AND ')} 
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
 * Create notification
 */
export async function createNotification(req, res, next) {
  try {
    const body = req.body;
    const userId = body.user_id || body.userId || body.recipient_id;
    const title = body.title;
    const message = body.message;

    validateRequired({ userId, title, message }, ['userId', 'title', 'message']);

    const id = body.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const type = body.type || 'system';
    const isRead = Boolean(body.is_read || false);
    const actionUrl = body.action_url || body.actionUrl || null;
    const metadata = body.metadata || {};

    // Ensure user exists
    await query(
      `INSERT INTO users (user_id, display_name) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, 'Agro User']
    );

    const result = await query(
      `INSERT INTO notifications (
        id, user_id, title, message, type,
        is_read, action_url, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        is_read = EXCLUDED.is_read,
        action_url = EXCLUDED.action_url,
        metadata = EXCLUDED.metadata
      RETURNING *`,
      [id, userId, title, message, type, isRead, actionUrl, JSON.stringify(metadata)]
    );

    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Notification "${id}" not found`
      });
    }

    res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(req, res, next) {
  try {
    const { userId } = req.params;
    validateRequired({ userId }, ['userId']);

    await query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
      [userId]
    );

    res.status(200).json({ status: 'success', message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM notifications WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Notification "${id}" not found`
      });
    }

    res.status(200).json({ status: 'success', message: `Notification "${id}" deleted` });
  } catch (err) {
    next(err);
  }
}
