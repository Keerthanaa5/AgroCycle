import { query } from '../db/pool.js';
import { validateRequired } from '../validators/inputValidators.js';

/**
 * Handle synchronization for a single entity type (compatible with FutureRemoteSyncAdapter)
 */
export async function syncEntityAction(req, res, next) {
  try {
    const { entityType } = req.params;
    const body = req.body;
    const idempotencyKey =
      req.headers['x-idempotency-key'] ||
      body.idempotencyKey ||
      body.idempotency_key ||
      `${body.userId}_${body.actionType}_${body.entityId}`;

    const userId = body.userId || body.user_id;
    const actionType = body.actionType || body.action_type || 'UPSERT';
    const entityId = body.entityId || body.entity_id;
    const payload = body.payload || {};

    validateRequired({ userId, entityId, entityType }, ['userId', 'entityId', 'entityType']);

    // 1. Check Idempotency Table
    const existing = await query(
      'SELECT * FROM sync_events WHERE idempotency_key = $1 LIMIT 1',
      [idempotencyKey]
    );

    if (existing.rows.length > 0) {
      return res.status(200).json({
        status: 'success',
        synced: true,
        replayed: true,
        serverId: entityId,
        data: existing.rows[0].payload,
        timestamp: existing.rows[0].processed_at
      });
    }

    // 2. Ensure user exists
    await query(
      `INSERT INTO users (user_id, display_name, phone) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO NOTHING`,
      [
        userId,
        payload.farmer_name || payload.farmerName || payload.creatorName || payload.display_name || payload.name || payload.user || 'Agro User',
        payload.phone || payload.contact_phone || payload.creatorPhone || null
      ]
    );

    // 3. Process entity according to type
    const normalizedType = entityType.toLowerCase().replace(/[^a-z0-9]/g, '');

    // A. Farms & Locations (Check location before generic user check)
    if (normalizedType.includes('location') || normalizedType.includes('farm')) {
      const farmId = payload.farm_id || payload.farmId || 'default';
      const farmName = payload.farm_name || payload.farmName || 'Main Farm';
      const lat = Number(payload.latitude || 0);
      const lon = Number(payload.longitude || 0);
      const accuracy = Number(payload.accuracy || 0);
      const city = payload.city || null;
      const district = payload.district || null;
      const state = payload.state || null;
      const country = payload.country || 'India';
      const isDefault = payload.is_default !== undefined ? Boolean(payload.is_default) : (farmId === 'default');

      await query(
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
          city = EXCLUDED.city,
          district = EXCLUDED.district,
          state = EXCLUDED.state,
          country = EXCLUDED.country,
          is_default = EXCLUDED.is_default,
          updated_at = CURRENT_TIMESTAMP`,
        [
          entityId, userId, farmId, farmName, lat, lon,
          accuracy, payload.source || 'device-gps', city, district, state, country, isDefault
        ]
      );
    }
    // B. Users / UserProfile
    else if (normalizedType.includes('user') || normalizedType.includes('profile')) {
      const displayName = payload.display_name || payload.name || 'Agro User';
      const phone = payload.phone || null;
      const roles = Array.isArray(payload.roles) ? payload.roles : [payload.role || 'farmer'];
      const activeRole = payload.active_role || payload.activeRole || roles[0] || 'farmer';
      const verificationStatus = payload.verification_status || payload.verificationStatus || 'pending';
      const language = payload.language || 'english';

      await query(
        `INSERT INTO users (
          user_id, display_name, phone, roles, active_role,
          verification_status, language, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
          display_name = COALESCE(EXCLUDED.display_name, users.display_name),
          phone = COALESCE(EXCLUDED.phone, users.phone),
          roles = COALESCE(EXCLUDED.roles, users.roles),
          active_role = COALESCE(EXCLUDED.active_role, users.active_role),
          verification_status = COALESCE(EXCLUDED.verification_status, users.verification_status),
          language = COALESCE(EXCLUDED.language, users.language),
          updated_at = CURRENT_TIMESTAMP`,
        [userId, displayName, phone, roles, activeRole, verificationStatus, language]
      );
    }
    // C. Marketplace Listings (Urban Waste Matcher)
    else if (normalizedType.includes('market') || normalizedType.includes('waste')) {
      const cropType = payload.crop_type || payload.cropType || payload.crop || 'Crop Waste';
      const quantityKg = Number(payload.quantity_kg || payload.quantityKg || payload.quantity?.value || 100);
      const condition = payload.condition || 'damaged';
      const sourceAssessmentId = payload.source_assessment_id || payload.sourceAssessmentId || payload.assessmentId || null;

      await query(
        `INSERT INTO marketplace_listings (
          id, creator_id, creator_role, source_assessment_id, title, crop_type,
          quantity_kg, condition, asking_price, status, location,
          latitude, longitude, district, state, farmer_name, contact_phone, image_url,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          source_assessment_id = COALESCE(EXCLUDED.source_assessment_id, marketplace_listings.source_assessment_id),
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
          farmer_name = EXCLUDED.farmer_name,
          contact_phone = EXCLUDED.contact_phone,
          image_url = EXCLUDED.image_url,
          updated_at = CURRENT_TIMESTAMP`,
        [
          entityId, userId, payload.creatorRole || 'farmer', sourceAssessmentId, payload.title || `${cropType} Crop Waste`,
          cropType, quantityKg, condition, payload.asking_price || payload.expectedPrice || null,
          payload.status || 'listed', payload.location || payload.readableLocation || null,
          payload.latitude || null, payload.longitude || null, payload.district || null, payload.state || null,
          payload.farmer_name || 'Agro Farmer', payload.contact_phone || null, payload.image_url || null
        ]
      );
    }
    // D. Field Assessments (Viability Scanner)
    else if (normalizedType.includes('scan') || normalizedType.includes('assessment')) {
      const cropName = payload.cropName || payload.crop_name || payload.crop || 'Crop';
      await query(
        `INSERT INTO field_assessments (
          id, user_id, crop_name, cultivated_acres, condition,
          primary_disease, severity_score, confidence, visual_coverage,
          visual_disease_burden, spatial_samples, recommendation,
          commercial_context, location_metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          crop_name = EXCLUDED.crop_name,
          cultivated_acres = EXCLUDED.cultivated_acres,
          condition = EXCLUDED.condition,
          primary_disease = EXCLUDED.primary_disease,
          severity_score = EXCLUDED.severity_score,
          confidence = EXCLUDED.confidence,
          visual_coverage = EXCLUDED.visual_coverage,
          visual_disease_burden = EXCLUDED.visual_disease_burden,
          spatial_samples = EXCLUDED.spatial_samples,
          recommendation = EXCLUDED.recommendation,
          commercial_context = EXCLUDED.commercial_context,
          location_metadata = EXCLUDED.location_metadata,
          updated_at = CURRENT_TIMESTAMP`,
        [
          entityId, userId, cropName, Number(payload.cultivatedAcres || payload.fieldArea || 1),
          payload.condition || 'unknown', payload.primaryDisease || null,
          Number(payload.severityScore || 0), Number(payload.confidence || 0),
          Number(payload.visualCoverage || 0), Number(payload.visualDiseaseBurden || 0),
          JSON.stringify(payload.samples || []), JSON.stringify(payload.recommendation || payload.finalRecommendation || {}),
          JSON.stringify(payload.commercialContext || {}), JSON.stringify(payload.location || {})
        ]
      );
    }
    // E. Buyer Requirements
    else if (normalizedType.includes('buyer')) {
      const crop = payload.crop || payload.cropName || 'Crop';
      const quantityRequired = Number(payload.quantity_required || payload.quantityRequired || 100);
      await query(
        `INSERT INTO buyer_requirements (
          id, buyer_id, business_name, business_type, crop,
          variety, quantity_required, unit, target_price, buying_radius_km,
          city, district, state, contact_person, phone, email, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          business_name = EXCLUDED.business_name,
          crop = EXCLUDED.crop,
          variety = EXCLUDED.variety,
          quantity_required = EXCLUDED.quantity_required,
          target_price = EXCLUDED.target_price,
          buying_radius_km = EXCLUDED.buying_radius_km,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP`,
        [
          entityId, userId, payload.business_name || payload.businessName || 'Verified Buyer',
          payload.business_type || 'Processing Unit', crop, payload.variety || 'Commercial Grade',
          quantityRequired, payload.unit || 'kg', payload.target_price || payload.targetPrice || null,
          Number(payload.buying_radius_km || payload.buyingRadiusKm || 50),
          payload.city || null, payload.district || null, payload.state || null,
          payload.contact_person || null, payload.phone || null, payload.email || null,
          payload.status || 'active'
        ]
      );
    }
    // F. Silage Centers
    else if (normalizedType.includes('silagecenter')) {
      const name = payload.name || 'Silage Center';
      const location = payload.location || 'Local Facility';
      const pricePerKg = Number(payload.price_per_kg || payload.pricePerKg || payload.price || 2.5);
      const capacityKg = Number(payload.capacity_kg || payload.capacityKg || 10000);
      const availableKg = Number(payload.available_kg || payload.availableKg || capacityKg);
      const contactPhone = payload.contact_phone || payload.phone || null;

      await query(
        `INSERT INTO silage_centers (
          id, creator_id, creator_role, name, location,
          district, state, latitude, longitude,
          capacity_kg, available_kg, price_per_kg, contact_phone, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          location = EXCLUDED.location,
          price_per_kg = EXCLUDED.price_per_kg,
          capacity_kg = EXCLUDED.capacity_kg,
          available_kg = EXCLUDED.available_kg,
          contact_phone = EXCLUDED.contact_phone,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP`,
        [
          entityId, userId, payload.creatorRole || 'buyer', name, location,
          payload.district || null, payload.state || null, payload.latitude || null, payload.longitude || null,
          capacityKg, availableKg, pricePerKg, contactPhone, payload.status || 'operational'
        ]
      );
    }
    // G. Silage Bookings
    else if (normalizedType.includes('silagebooking')) {
      const cropType = payload.crop_type || payload.cropType || 'Crop Feed';
      const quantityKg = Number(payload.quantity_kg || payload.quantityKg || 100);
      const pricePerKg = Number(payload.price_per_kg || payload.pricePerKg || 0);
      const totalPrice = Number(payload.total_price || payload.totalPrice || (quantityKg * pricePerKg));

      await query(
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
          updated_at = CURRENT_TIMESTAMP`,
        [
          entityId, userId, payload.center_id || payload.centerId || null, cropType, quantityKg,
          payload.pickup_date || payload.pickupDate || new Date().toISOString().split('T')[0],
          pricePerKg, totalPrice, payload.status || 'requested',
          payload.farmer_name || payload.farmerName || 'Farmer', payload.location || null,
          payload.contact_phone || payload.farmer_phone || payload.phone || null
        ]
      );
    }
    // H. Carbon Activities
    else if (normalizedType.includes('carbonactivit')) {
      const activityType = payload.activity_type || payload.activityType || 'composting';
      const areaAcres = Number(payload.area_acres || payload.areaAcres || 1);
      const co2SavedKg = Number(payload.co2_saved_kg || payload.co2Saved || (areaAcres * 850));
      const creditsEarned = Number(payload.credits_earned || payload.credits || (co2SavedKg / 1000));
      const creditValueInr = Number(payload.credit_value_inr || payload.value || (creditsEarned * 500));

      await query(
        `INSERT INTO carbon_activities (
          id, creator_id, creator_role, activity_type, description,
          area_acres, co2_saved_kg, credits_earned, credit_value_inr,
          status, sponsor_id, proof_image_url, farmer_name,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          activity_type = EXCLUDED.activity_type,
          description = EXCLUDED.description,
          area_acres = EXCLUDED.area_acres,
          co2_saved_kg = EXCLUDED.co2_saved_kg,
          credits_earned = EXCLUDED.credits_earned,
          credit_value_inr = EXCLUDED.credit_value_inr,
          status = EXCLUDED.status,
          sponsor_id = COALESCE(EXCLUDED.sponsor_id, carbon_activities.sponsor_id),
          farmer_name = EXCLUDED.farmer_name,
          updated_at = CURRENT_TIMESTAMP`,
        [
          entityId, userId, payload.creatorRole || 'farmer', activityType, payload.description || null,
          areaAcres, co2SavedKg, creditsEarned, creditValueInr,
          payload.status || 'pending', payload.sponsor_id || payload.sponsorId || null,
          payload.proof_image_url || payload.image || null, payload.farmer_name || payload.farmerName || 'Farmer'
        ]
      );
    }
    // I. Carbon Offers
    else if (normalizedType.includes('carbonoffer')) {
      const activityId = payload.activity_id || payload.activityId;
      const offeredPriceInr = Number(payload.offered_price_inr || payload.offeredPrice || payload.value || 500);

      await query(
        `INSERT INTO carbon_offers (
          id, activity_id, sponsor_id, offered_price_inr, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          offered_price_inr = EXCLUDED.offered_price_inr,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP`,
        [entityId, activityId, userId, offeredPriceInr, payload.status || 'offered']
      );

      if (activityId) {
        await query(
          `UPDATE carbon_activities 
           SET status = 'offer_received', sponsor_id = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [userId, activityId]
        );
      }
    }
    // J. Claim Dossiers (Insurance Claim Evidence)
    else if (normalizedType.includes('claim') || normalizedType.includes('dossier')) {
      const cropType = payload.crop_type || payload.cropType || 'Crop';
      const damageType = payload.damage_type || payload.damageType || 'other';
      const aiReport = typeof payload.ai_report === 'object' ? JSON.stringify(payload.ai_report) : (payload.ai_report || payload.evidenceReview ? JSON.stringify(payload.evidenceReview) : null);

      await query(
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
          updated_at = CURRENT_TIMESTAMP`,
        [
          entityId, userId, payload.farmer_id || payload.farmerId || userId,
          payload.source_assessment_id || payload.sourceAssessmentId || payload.assessmentId || null,
          payload.farmer_name || payload.farmerName || 'Farmer',
          payload.mobile_number || payload.phone || '9876543210',
          payload.aadhar_number || payload.aadhar || 'N/A',
          payload.date_of_birth || payload.dob || 'N/A',
          cropType, damageType, Number(payload.damage_percentage || payload.damagePercentage || 0),
          Number(payload.area_acres || payload.areaAcres || 1),
          Number(payload.estimated_loss_inr || payload.estimatedLoss || 0),
          Number(payload.claim_amount_inr || payload.claimAmount || 0),
          payload.status || 'draft',
          payload.damage_image_url || payload.image || null,
          payload.location || null, payload.latitude || null, payload.longitude || null, aiReport
        ]
      );
    }
    // K. AgroConnect Posts (Community Exchange)
    else if (normalizedType.includes('agro') || normalizedType.includes('croppost')) {
      const cropType = payload.crop_type || payload.crop || payload.cropName || 'Crop';
      const title = payload.title || `${cropType} Post`;
      const rawQty = payload.quantity_kg ?? payload.quantity;
      const quantityKg = (rawQty !== undefined && rawQty !== null && rawQty !== '') ? Number(rawQty) : null;
      const condition = payload.condition || null;
      const topic = payload.topic || payload.problemTopic || payload.problem || null;
      const resourceNeeded = payload.resource_needed || payload.resourceNeeded || null;
      const description = payload.description || payload.details || title;
      const interactions = JSON.stringify(payload.interactions || []);
      const connections = JSON.stringify(payload.connections || []);
      const location = payload.location || payload.readableLocation || payload.district || 'Local Farm';
      const postType = payload.post_type || payload.postType || 'offering_waste';
      const imageUrl = payload.image_url || payload.image || null;
      const contactPhone = payload.contact_phone || payload.phone || payload.creatorPhone || null;
      const farmerName = payload.farmer_name || payload.farmerName || payload.creatorName || payload.user || payload.name || 'Community Farmer';
      const creatorRole = payload.creator_role || payload.creatorRole || 'farmer';
      const status = payload.status || 'available';

      await query(
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
          interactions = EXCLUDED.interactions,
          connections = EXCLUDED.connections,
          updated_at = CURRENT_TIMESTAMP`,
        [
          entityId, userId, creatorRole, title, cropType,
          quantityKg, condition, location, postType,
          topic, resourceNeeded, description,
          imageUrl, contactPhone, farmerName, status,
          interactions, connections
        ]
      );
    }
    // L. Notifications
    else if (normalizedType.includes('notif')) {
      const title = payload.title || 'Notification';
      const message = payload.message || '';
      const isRead = Boolean(payload.is_read || payload.isRead || false);

      await query(
        `INSERT INTO notifications (
          id, user_id, title, message, type,
          is_read, action_url, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          message = EXCLUDED.message,
          is_read = EXCLUDED.is_read,
          action_url = EXCLUDED.action_url,
          metadata = EXCLUDED.metadata`,
        [
          entityId, userId, title, message, payload.type || 'system',
          isRead, payload.action_url || payload.actionUrl || null,
          JSON.stringify(payload.metadata || {})
        ]
      );
    }

    // 4. Save to sync_events audit log
    const syncResult = await query(
      `INSERT INTO sync_events (
        id, user_id, action_type, entity_type, entity_id,
        idempotency_key, payload, status, processed_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'synced', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        `se_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId, actionType, entityType, entityId,
        idempotencyKey, JSON.stringify(payload)
      ]
    );

    res.status(200).json({
      status: 'success',
      synced: true,
      serverId: entityId,
      timestamp: syncResult.rows[0].processed_at
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle batch offline synchronization
 */
export async function syncBatch(req, res, next) {
  try {
    const { userId, events = [] } = req.body;
    validateRequired({ userId }, ['userId']);

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(200).json({
        status: 'success',
        processed: 0,
        results: []
      });
    }

    const results = [];
    for (const evt of events) {
      const idempotencyKey = evt.idempotencyKey || `${userId}_${evt.actionType}_${evt.entityId}`;
      const existing = await query(
        'SELECT * FROM sync_events WHERE idempotency_key = $1 LIMIT 1',
        [idempotencyKey]
      );

      if (existing.rows.length > 0) {
        results.push({
          entityId: evt.entityId,
          status: 'synced',
          replayed: true
        });
      } else {
        await query(
          `INSERT INTO sync_events (
            id, user_id, action_type, entity_type, entity_id,
            idempotency_key, payload, status, processed_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'synced', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            `se_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            userId, evt.actionType || 'UPSERT', evt.entityType || 'generic',
            evt.entityId, idempotencyKey, JSON.stringify(evt.payload || {})
          ]
        );
        results.push({
          entityId: evt.entityId,
          status: 'synced',
          replayed: false
        });
      }
    }

    res.status(200).json({
      status: 'success',
      processed: results.length,
      results
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get sync events for a user
 */
export async function getUserSyncHistory(req, res, next) {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const result = await query(
      `SELECT id, user_id, action_type, entity_type, entity_id, idempotency_key, status, processed_at 
       FROM sync_events 
       WHERE user_id = $1 
       ORDER BY processed_at DESC 
       LIMIT $2`,
      [userId, Number(limit)]
    );

    res.status(200).json({
      status: 'success',
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
}
