import { query } from '../db/pool.js';
import { validateRequired, validateNumber } from '../validators/inputValidators.js';
import {
  broadcastAgroConnectCreated,
  broadcastAgroConnectUpdated,
  broadcastAgroConnectDeleted
} from '../realtime/socketManager.js';

const ALLOWED_POST_TYPES = [
  'offering_waste',
  'requesting_resource',
  'seeking_advice',
  'sharing_knowledge'
];

/**
 * Get AgroConnect community posts with crop, category, location filtering
 */
export async function getAgroConnectPosts(req, res, next) {
  try {
    const {
      crop_type,
      post_type,
      location,
      creator_id,
      search,
      status = 'available',
      limit = 50
    } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (crop_type) {
      conditions.push(`LOWER(crop_type) LIKE $${idx++}`);
      values.push(`%${crop_type.toLowerCase()}%`);
    }

    if (post_type && post_type !== 'all') {
      conditions.push(`post_type = $${idx++}`);
      values.push(post_type);
    }

    if (location) {
      conditions.push(`LOWER(location) LIKE $${idx++}`);
      values.push(`%${location.toLowerCase()}%`);
    }

    if (creator_id) {
      conditions.push(`creator_id = $${idx++}`);
      values.push(creator_id);
    }

    if (status && status !== 'all') {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }

    if (search) {
      conditions.push(`(LOWER(crop_type) LIKE $${idx} OR LOWER(title) LIKE $${idx} OR LOWER(location) LIKE $${idx} OR LOWER(COALESCE(topic, '')) LIKE $${idx})`);
      values.push(`%${search.toLowerCase()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Number(limit));

    const sql = `
      SELECT * FROM agroconnect_posts 
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
 * Get AgroConnect post by ID
 */
export async function getAgroConnectPostById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM agroconnect_posts WHERE id = $1 LIMIT 1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `AgroConnect post "${id}" not found`
      });
    }

    res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Create AgroConnect crop community post (strictly farmer-to-farmer crop knowledge & resources)
 */
export async function createAgroConnectPost(req, res, next) {
  try {
    const body = req.body;
    const creatorId = body.creator_id || body.creatorId || body.userId;
    const postType = body.post_type || body.postType || 'offering_waste';
    const cropType = body.crop_type || body.crop || body.cropType;

    if (!ALLOWED_POST_TYPES.includes(postType)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_POST_TYPE',
        message: `Invalid post type "${postType}". Allowed post types: ${ALLOWED_POST_TYPES.join(', ')}`
      });
    }

    validateRequired({ creatorId, cropType }, ['creatorId', 'cropType']);

    let title = body.title || `${cropType} Post`;
    let quantityKg = null;
    let condition = body.condition || 'fresh';
    let location = body.location || 'Local Farm';
    let topic = body.topic || body.problemTopic || null;
    let resourceNeeded = body.resource_needed || body.resourceNeeded || null;
    let description = body.description || body.details || title;

    // Type-specific field validations
    if (postType === 'offering_waste') {
      validateRequired({ location }, ['location']);
      const rawQty = body.quantity_kg ?? body.quantityKg ?? body.quantity;
      if (rawQty === undefined || rawQty === null || Number(rawQty) <= 0) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'quantity_kg must be a positive number for offering crop waste'
        });
      }
      quantityKg = Number(rawQty);
      if (!title || title === `${cropType} Post`) {
        title = `${quantityKg}kg ${cropType} Crop Residue / Waste Available`;
      }
    } else if (postType === 'requesting_resource') {
      validateRequired({ location, resourceNeeded }, ['location', 'resourceNeeded']);
      const rawQty = body.quantity_kg ?? body.quantityKg ?? body.quantity;
      if (rawQty !== undefined && rawQty !== null && Number(rawQty) > 0) {
        quantityKg = Number(rawQty);
      }
      if (!title || title === `${cropType} Post`) {
        title = `Requesting ${resourceNeeded} for ${cropType} Crop`;
      }
    } else if (postType === 'seeking_advice') {
      topic = topic || body.problem || 'Crop Advice';
      validateRequired({ topic, description }, ['topic', 'description']);
      if (!title || title === `${cropType} Post`) {
        title = `Seeking Advice: ${topic} in ${cropType}`;
      }
      condition = null;
    } else if (postType === 'sharing_knowledge') {
      topic = topic || body.technique || 'Crop Practice';
      validateRequired({ topic, description }, ['topic', 'description']);
      if (!title || title === `${cropType} Post`) {
        title = `Crop Practice: ${topic} for ${cropType}`;
      }
      condition = null;
    }

    const id = body.id || `ap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const creatorRole = body.creator_role || body.creatorRole || 'farmer';
    const imageUrl = body.image_url || body.image || null;
    const contactPhone = body.contact_phone || body.phone || null;
    const farmerName = body.farmer_name || body.farmerName || body.user || 'Community Farmer';
    const status = body.status || 'available';

    // Ensure user exists
    await query(
      `INSERT INTO users (user_id, display_name, phone) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO NOTHING`,
      [creatorId, farmerName, contactPhone]
    );

    const result = await query(
      `INSERT INTO agroconnect_posts (
        id, creator_id, creator_role, title, crop_type,
        quantity_kg, condition, location, post_type,
        topic, resource_needed, description,
        image_url, contact_phone, farmer_name, status,
        interactions, connections,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        crop_type = EXCLUDED.crop_type,
        quantity_kg = EXCLUDED.quantity_kg,
        condition = EXCLUDED.condition,
        location = EXCLUDED.location,
        post_type = EXCLUDED.post_type,
        topic = EXCLUDED.topic,
        resource_needed = EXCLUDED.resource_needed,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        contact_phone = EXCLUDED.contact_phone,
        farmer_name = EXCLUDED.farmer_name,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        id, creatorId, creatorRole, title, cropType,
        quantityKg, condition, location, postType,
        topic, resourceNeeded, description,
        imageUrl, contactPhone, farmerName, status,
        JSON.stringify(body.interactions || []),
        JSON.stringify(body.connections || [])
      ]
    );

    const savedPost = result.rows[0];
    broadcastAgroConnectCreated(savedPost);

    res.status(201).json({ status: 'success', data: savedPost });
  } catch (err) {
    next(err);
  }
}


/**
 * Update AgroConnect post (strictly owner only)
 */
export async function updateAgroConnectPost(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body;
    const userId = body.userId || body.user_id || body.creatorId || body.creator_id;

    if (!userId) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'userId is required to verify post ownership'
      });
    }

    const existingRes = await query('SELECT * FROM agroconnect_posts WHERE id = $1 LIMIT 1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `AgroConnect post "${id}" not found`
      });
    }

    const post = existingRes.rows[0];
    if (post.creator_id !== userId) {
      return res.status(403).json({
        status: 'error',
        code: 'UNAUTHORIZED_ACTION',
        message: 'Only the creator of this community post can update it'
      });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (body.title !== undefined) { fields.push(`title = $${idx++}`); values.push(body.title); }
    if (body.description !== undefined) { fields.push(`description = $${idx++}`); values.push(body.description); }
    if (body.topic !== undefined) { fields.push(`topic = $${idx++}`); values.push(body.topic); }
    if (body.resource_needed !== undefined || body.resourceNeeded !== undefined) {
      fields.push(`resource_needed = $${idx++}`);
      values.push(body.resource_needed ?? body.resourceNeeded);
    }
    if (body.quantity_kg !== undefined || body.quantityKg !== undefined) {
      fields.push(`quantity_kg = $${idx++}`);
      values.push(body.quantity_kg ?? body.quantityKg);
    }
    if (body.condition !== undefined) { fields.push(`condition = $${idx++}`); values.push(body.condition); }
    if (body.location !== undefined) { fields.push(`location = $${idx++}`); values.push(body.location); }
    if (body.status !== undefined) { fields.push(`status = $${idx++}`); values.push(body.status); }
    if (body.image_url !== undefined || body.image !== undefined) {
      fields.push(`image_url = $${idx++}`);
      values.push(body.image_url ?? body.image);
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

    const updateSql = `UPDATE agroconnect_posts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await query(updateSql, values);

    const updatedPost = result.rows[0];
    broadcastAgroConnectUpdated(updatedPost);

    res.status(200).json({ status: 'success', data: updatedPost });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete AgroConnect post (strictly owner only)
 */
export async function deleteAgroConnectPost(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.query.userId || req.query.user_id || req.body?.userId || req.body?.user_id;

    const existingRes = await query('SELECT * FROM agroconnect_posts WHERE id = $1 LIMIT 1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `AgroConnect post "${id}" not found`
      });
    }

    const post = existingRes.rows[0];
    if (userId && post.creator_id !== userId) {
      return res.status(403).json({
        status: 'error',
        code: 'UNAUTHORIZED_ACTION',
        message: 'Only the creator of this community post can delete it'
      });
    }

    await query('DELETE FROM agroconnect_posts WHERE id = $1', [id]);
    broadcastAgroConnectDeleted({ id, deletedPost: post });

    res.status(200).json({ status: 'success', message: `AgroConnect post "${id}" deleted`, data: { id } });
  } catch (err) {
    next(err);
  }
}


/**
 * Interact with an AgroConnect post (express interest, offer help, reply)
 * and notify post creator
 */
export async function interactWithPost(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body;
    const farmerId = body.farmer_id || body.farmerId || body.userId;
    const farmerName = body.farmer_name || body.farmerName || 'Neighboring Farmer';
    const interactionType = body.interaction_type || body.interactionType || 'interested';
    const message = body.message || '';
    const contactPhone = body.contact_phone || body.phone || null;

    validateRequired({ farmerId, interactionType }, ['farmerId', 'interactionType']);

    const existingRes = await query('SELECT * FROM agroconnect_posts WHERE id = $1 LIMIT 1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `AgroConnect post "${id}" not found`
      });
    }

    const post = existingRes.rows[0];

    // Build interaction object
    const newInteraction = {
      id: `int_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      farmer_id: farmerId,
      farmer_name: farmerName,
      interaction_type: interactionType,
      message,
      contact_phone: contactPhone,
      created_at: new Date().toISOString()
    };

    const currentInteractions = Array.isArray(post.interactions) ? post.interactions : [];
    const updatedInteractions = [...currentInteractions, newInteraction];

    const updateRes = await query(
      `UPDATE agroconnect_posts 
       SET interactions = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [JSON.stringify(updatedInteractions), id]
    );

    // Create notification for the post creator
    const notifActionText = interactionType === 'offer_help'
      ? 'offered help on'
      : interactionType === 'reply'
      ? 'replied to'
      : 'is interested in';

    const notifTitle = `Farmer Community: ${farmerName}`;
    const notifMessage = `Farmer ${farmerName} ${notifActionText} your ${post.crop_type} post: "${post.title}".`;
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await query(
      `INSERT INTO notifications (
        id, user_id, title, message, type, is_read, action_url, metadata, created_at
      ) VALUES ($1, $2, $3, $4, 'agroconnect', FALSE, '/agro-connect', $5, CURRENT_TIMESTAMP)`,
      [
        notifId,
        post.creator_id,
        notifTitle,
        notifMessage,
        JSON.stringify({
          postId: id,
          interactionId: newInteraction.id,
          farmerId,
          farmerName,
          interactionType
        })
      ]
    );

    const updatedPost = updateRes.rows[0];
    broadcastAgroConnectUpdated(updatedPost);

    res.status(200).json({
      status: 'success',
      data: {
        post: updatedPost,
        interaction: newInteraction
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Manage farmer-to-farmer connection (Accept or Decline connection)
 */
export async function manageConnection(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body;
    const userId = body.userId || body.user_id;
    const requestingFarmerId = body.requestingFarmerId || body.requesting_farmer_id;
    const requestingFarmerName = body.requestingFarmerName || body.requesting_farmer_name || 'Farmer';
    const action = body.action || 'accept'; // 'accept' | 'decline'

    validateRequired({ userId, requestingFarmerId, action }, ['userId', 'requestingFarmerId', 'action']);

    const existingRes = await query('SELECT * FROM agroconnect_posts WHERE id = $1 LIMIT 1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `AgroConnect post "${id}" not found`
      });
    }

    const post = existingRes.rows[0];
    if (post.creator_id !== userId) {
      return res.status(403).json({
        status: 'error',
        code: 'UNAUTHORIZED_ACTION',
        message: 'Only the post creator can manage connection requests'
      });
    }

    const currentConnections = Array.isArray(post.connections) ? post.connections : [];
    let updatedConnections;

    if (action === 'accept') {
      const existingConn = currentConnections.find(c => c.farmer_id === requestingFarmerId);
      if (existingConn) {
        existingConn.status = 'connected';
        existingConn.connected_at = new Date().toISOString();
        updatedConnections = currentConnections;
      } else {
        updatedConnections = [
          ...currentConnections,
          {
            farmer_id: requestingFarmerId,
            farmer_name: requestingFarmerName,
            status: 'connected',
            connected_at: new Date().toISOString()
          }
        ];
      }

      // Notify the requesting farmer that connection was accepted
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await query(
        `INSERT INTO notifications (
          id, user_id, title, message, type, is_read, action_url, metadata, created_at
        ) VALUES ($1, $2, $3, $4, 'agroconnect', FALSE, '/agro-connect', $5, CURRENT_TIMESTAMP)`,
        [
          notifId,
          requestingFarmerId,
          'Farmer-to-Farmer Connection Accepted!',
          `Farmer ${post.farmer_name} accepted your connection on "${post.title}". You can now coordinate directly.`,
          JSON.stringify({ postId: id, connectedWith: post.creator_id, postTitle: post.title })
        ]
      );
    } else {
      updatedConnections = currentConnections.filter(c => c.farmer_id !== requestingFarmerId);
    }

    const updateRes = await query(
      `UPDATE agroconnect_posts 
       SET connections = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [JSON.stringify(updatedConnections), id]
    );

    const updatedPost = updateRes.rows[0];
    broadcastAgroConnectUpdated(updatedPost);

    res.status(200).json({
      status: 'success',
      data: updatedPost
    });
  } catch (err) {
    next(err);
  }
}

