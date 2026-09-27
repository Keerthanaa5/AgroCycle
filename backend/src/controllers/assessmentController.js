import { query } from '../db/pool.js';
import { validateRequired } from '../validators/inputValidators.js';

export async function getAssessments(req, res, next) {
  try {
    const { userId, cropName, limit = 50, offset = 0 } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (userId) {
      conditions.push(`user_id = $${idx++}`);
      values.push(userId);
    }
    if (cropName) {
      conditions.push(`LOWER(crop_name) LIKE $${idx++}`);
      values.push(`%${cropName.toLowerCase()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Number(limit));
    const limitParam = `$${idx++}`;
    values.push(Number(offset));
    const offsetParam = `$${idx++}`;

    const sql = `
      SELECT * FROM field_assessments 
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

export async function getAssessmentById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Assessment ID is required'
      });
    }

    const result = await query(
      'SELECT * FROM field_assessments WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Field assessment with id "${id}" not found`
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

export async function createAssessment(req, res, next) {
  try {
    const body = req.body;
    const userId = body.user_id || body.userId || body.creatorId;
    const cropName = body.crop_name || body.cropName || body.crop;

    validateRequired({ userId, cropName }, ['userId', 'cropName']);

    const id = body.id || `vs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const farmId = body.farm_id || body.farmId || 'default';
    const cultivatedAcres = Number(body.cultivated_acres || body.cultivatedAcres || body.fieldArea || 1.0);
    const condition = body.condition || body.conditionQuality || 'unknown';
    const primaryDisease = body.primary_disease || body.primaryDisease || null;
    const severityScore = Number(body.severity_score || body.severityScore || body.fieldSeverityScore || 0);
    const confidence = Number(body.confidence || 0);
    const visualCoverage = Number(body.visual_coverage || body.visualCoverage || 0);
    const visualDiseaseBurden = Number(body.visual_disease_burden || body.visualDiseaseBurden || 0);
    const spatialSamples = body.spatial_samples || body.samples || [];
    const recommendation = body.recommendation || body.finalRecommendation || {};
    const commercialContext = body.commercial_context || body.commercialContext || {};
    const locationMetadata = body.location_metadata || body.location || {};

    // Ensure user exists first
    await query(
      `INSERT INTO users (user_id, display_name) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, body.farmer_name || 'Agro Farmer']
    );

    const result = await query(
      `INSERT INTO field_assessments (
        id, user_id, farm_id, crop_name, cultivated_acres,
        condition, primary_disease, severity_score, confidence,
        visual_coverage, visual_disease_burden, spatial_samples,
        recommendation, commercial_context, location_metadata,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        id, userId, farmId, cropName, cultivatedAcres,
        condition, primaryDisease, severityScore, confidence,
        visualCoverage, visualDiseaseBurden, JSON.stringify(spatialSamples),
        JSON.stringify(recommendation), JSON.stringify(commercialContext), JSON.stringify(locationMetadata)
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
