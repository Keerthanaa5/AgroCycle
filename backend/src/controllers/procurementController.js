import { query, getPool } from '../db/pool.js';
import { validateRequired, validateNumber } from '../validators/inputValidators.js';
import { 
  broadcastProcurementOrderCreated, 
  broadcastProcurementOrderUpdated,
  broadcastListingUpdated 
} from '../realtime/socketManager.js';
import { normalizeMarketIntelligenceGrade } from '../config/marketIntelligence.js';

/**
 * Contact Information Visibility Filter
 * 
 * Rules:
 * Before procurement confirmation OR for unrelated third parties:
 * - Hide all personal contact numbers (buyer_phone = null, farmerPhone = null, driverPhone = null, transporterPhone = null).
 * 
 * After procurement is confirmed AND transport is arranged:
 * - Farmer sees: Buyer name/phone, Transporter name/phone, Driver name/phone, Vehicle, Schedule, Destination, GPS.
 * - Buyer sees: Farmer name/phone, Transporter name/phone, Driver name/phone, Vehicle, Schedule, Destination, GPS.
 * - Driver/Transporter sees: Farmer name/phone, Buyer name/phone, Transporter name/phone, Driver name/phone.
 */
export function filterOrderContactVisibility(row, requesterId) {
  if (!row) return row;

  const status = (row.status || '').toUpperCase();
  const isConfirmed = ['CONFIRMED', 'FULLY_SOURCED', 'PARTIALLY_FULFILLED', 'READY_FOR_PICKUP', 'PAID', 'DELIVERED'].includes(status);

  let allocations = [];
  if (Array.isArray(row.farmer_allocations)) {
    allocations = row.farmer_allocations;
  } else if (typeof row.farmer_allocations === 'string') {
    try { allocations = JSON.parse(row.farmer_allocations); } catch (e) { allocations = []; }
  }

  const rawLogistics = row.logistics || row.procurement_summary?.logistics || null;

  // Determine requester relationship
  const reqLower = String(requesterId || '').toLowerCase().trim();
  const isBuyer = Boolean(
    requesterId && (
      requesterId === row.buyer_id ||
      requesterId === 'usr_buyer' ||
      (row.buyer_name && reqLower.includes(row.buyer_name.toLowerCase())) ||
      (row.buyer_id && reqLower.includes(String(row.buyer_id).toLowerCase()))
    )
  );

  const isFarmer = Boolean(
    requesterId && (
      allocations.some(a => 
        (a.farmerId && String(a.farmerId).toLowerCase() === reqLower) ||
        (a.farmer_id && String(a.farmer_id).toLowerCase() === reqLower) ||
        (a.farmerName && reqLower.includes(a.farmerName.toLowerCase()))
      ) ||
      requesterId === 'usr_farmer'
    )
  );

  const isTransporterOrDriver = Boolean(
    requesterId && (
      reqLower.includes('transporter') ||
      reqLower.includes('driver') ||
      (rawLogistics?.driverPhone && reqLower.includes(rawLogistics.driverPhone.toLowerCase())) ||
      (rawLogistics?.transporterPhone && reqLower.includes(rawLogistics.transporterPhone.toLowerCase()))
    )
  );

  const isInvolved = isBuyer || isFarmer || isTransporterOrDriver;

  // RULE 1: Unconfirmed order OR unrelated third party -> HIDE all personal contact details
  if (!isInvolved || !isConfirmed) {
    const sanitizedAllocations = allocations.map(a => {
      const copy = { ...a };
      delete copy.farmerPhone;
      delete copy.phone;
      return copy;
    });

    let sanitizedLogistics = null;
    if (rawLogistics) {
      sanitizedLogistics = {
        ...rawLogistics,
        driverPhone: null,
        transporterPhone: null
      };
    }

    const sanitizedSummary = row.procurement_summary ? {
      ...row.procurement_summary,
      logistics: sanitizedLogistics
    } : row.procurement_summary;

    return {
      ...row,
      buyer_phone: null,
      buyer: row.buyer ? { ...row.buyer, phone: null } : null,
      farmer_allocations: sanitizedAllocations,
      allocations: sanitizedAllocations,
      logistics: sanitizedLogistics,
      procurement_summary: sanitizedSummary
    };
  }

  // RULE 2: Confirmed order + involved parties
  // Buyer can see farmerPhone of all confirmed farmers in this order + transporter/driver phone
  // Farmer can see buyer_phone + transporter/driver phone
  // Driver/Transporter can see farmerPhone + buyer_phone + transporter/driver phone
  const sanitizedAllocations = allocations.map(a => {
    const copy = { ...a };
    if (!isBuyer && !isTransporterOrDriver) {
      // Farmer only sees their own contact phone, not other unrelated farmers' phones
      const isThisFarmer = (
        (a.farmerId && String(a.farmerId).toLowerCase() === reqLower) ||
        (a.farmer_id && String(a.farmer_id).toLowerCase() === reqLower) ||
        (a.farmerName && reqLower.includes(a.farmerName.toLowerCase())) ||
        requesterId === 'usr_farmer'
      );
      if (!isThisFarmer) {
        delete copy.farmerPhone;
        delete copy.phone;
      }
    }
    return copy;
  });

  return {
    ...row,
    farmer_allocations: sanitizedAllocations,
    allocations: sanitizedAllocations
  };
}

/**
 * Get all procurement orders with optional filtering
 */
export async function getProcurementOrders(req, res, next) {
  try {
    const requesterId = req.headers['x-user-id'] || req.headers['X-User-Id'] || req.query.user_id;
    const { buyer_id, farmer_id, crop, status, match_type, limit = 50, offset = 0 } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (buyer_id) {
      conditions.push(`buyer_id = $${idx++}`);
      values.push(buyer_id);
    }
    if (farmer_id) {
      conditions.push(`(farmer_allocations @> $${idx}::jsonb OR farmer_allocations @> $${idx + 1}::jsonb OR farmer_allocations::text ILIKE $${idx + 2})`);
      values.push(JSON.stringify([{ farmerId: farmer_id }]));
      values.push(JSON.stringify([{ farmer_id: farmer_id }]));
      values.push(`%${farmer_id}%`);
      idx += 3;
    }
    if (crop) {
      conditions.push(`LOWER(crop) LIKE $${idx++}`);
      values.push(`%${crop.toLowerCase()}%`);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }
    if (match_type) {
      conditions.push(`match_type = $${idx++}`);
      values.push(match_type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(Number(limit));
    const limitParam = `$${idx++}`;
    values.push(Number(offset));
    const offsetParam = `$${idx++}`;

    const sql = `
      SELECT * FROM procurement_orders 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const result = await query(sql, values);

    // Filter contacts based on privacy & participant role
    const sanitizedOrders = result.rows.map(row => filterOrderContactVisibility(row, requesterId));

    res.status(200).json({
      status: 'success',
      count: sanitizedOrders.length,
      data: sanitizedOrders
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get a single procurement order by ID or order_id
 */
export async function getProcurementOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const requesterId = req.headers['x-user-id'] || req.headers['X-User-Id'] || req.query.user_id;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Order ID is required'
      });
    }

    const result = await query(
      'SELECT * FROM procurement_orders WHERE id = $1 OR order_id = $1 LIMIT 1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Procurement order with ID "${id}" not found`
      });
    }

    const sanitizedOrder = filterOrderContactVisibility(result.rows[0], requesterId);

    res.status(200).json({
      status: 'success',
      data: sanitizedOrder
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new confirmed procurement order or append allocations to an existing partial requirement
 */
export async function createProcurementOrder(req, res, next) {
  const pool = getPool();
  let client = null;

  try {
    const body = req.body;
    const buyerObj = body.buyer || {};
    const demandObj = body.demand || {};
    const summaryObj = body.summary || body.procurementSummary || body.procurement_summary || {};

    const buyerId = body.buyer_id || body.buyerId || buyerObj.buyerId || buyerObj.id || req.headers['x-user-id'] || 'usr_buyer_commercial';
    const requesterId = req.headers['x-user-id'] || req.headers['X-User-Id'] || buyerId;
    const buyerName = body.buyer_name || body.buyerName || buyerObj.businessName || buyerObj.name || 'Commercial Buyer';
    const buyerPhone = body.buyer_phone || body.buyerPhone || buyerObj.phone || null;

    const crop = body.crop || body.produce || demandObj.crop || demandObj.produce;

    validateRequired({ buyerId, buyerName, crop }, ['buyerId', 'buyerName', 'crop']);

    const rawQty = body.requested_quantity_kg || body.requestedQuantityKg || body.quantity_kg || body.quantityKg || demandObj.quantityKg || (demandObj.quantityTonnes ? demandObj.quantityTonnes * 1000 : null) || (body.quantityTonnes ? body.quantityTonnes * 1000 : 1000);
    const requestedQuantityKg = validateNumber(rawQty, 'requested_quantity_kg', { min: 1 });

    const orderId = body.order_id || body.orderId || `PO-AC-${Math.floor(10000 + Math.random() * 90000)}`;
    const id = body.id || orderId;
    const category = body.category || demandObj.category || 'Vegetable';
    const rawQualityGrade = body.quality_grade || body.qualityGrade || demandObj.qualityGrade || 'Grade A — Fresh / Premium';
    const qualityGrade = normalizeMarketIntelligenceGrade(rawQualityGrade);
    const buyerType = body.buyer_type || body.buyerType || demandObj.buyerType || 'Food Processor';
    const intendedUse = body.intended_use || body.intendedUse || demandObj.intendedUse || 'Processing';
    const requiredDate = body.required_date || body.requiredDate || demandObj.requiredDate || new Date().toISOString().split('T')[0];
    const maxPricePerKg = body.max_price_per_kg !== undefined 
      ? (body.max_price_per_kg ? Number(body.max_price_per_kg) : null) 
      : (body.maxPricePerKg !== undefined 
          ? (body.maxPricePerKg ? Number(body.maxPricePerKg) : null) 
          : (demandObj.maxPricePerKg ? Number(demandObj.maxPricePerKg) : null));

    const deliveryLocation = typeof (body.delivery_location || body.deliveryLocation || demandObj.destinationLocation) === 'object'
      ? (body.deliveryLocation?.city || demandObj.destinationLocation?.city || demandObj.destinationLocation?.address || 'Madurai')
      : (body.delivery_location || body.deliveryLocation || 'Madurai');

    const deliveryLatitude = body.delivery_latitude || body.deliveryLatitude || demandObj.destinationLocation?.latitude || buyerObj.location?.latitude || null;
    const deliveryLongitude = body.delivery_longitude || body.deliveryLongitude || demandObj.destinationLocation?.longitude || buyerObj.location?.longitude || null;

    const orderType = body.order_type || body.orderType || 'ACCEPTED_RECOMMENDATION';
    const matchType = body.match_type || body.matchType || 'MARKET';
    const incomingAllocations = Array.isArray(body.farmer_allocations || body.farmerAllocations || body.allocations) 
      ? (body.farmer_allocations || body.farmerAllocations || body.allocations) 
      : [];
    const notes = body.notes || 'Procurement order confirmed via AgroCycle Fresh Produce Procurement Engine.';

    client = pool ? await pool.connect() : null;

    if (client) {
      await client.query('BEGIN');
    }

    const queryExec = client ? (q, p) => client.query(q, p) : query;

    // Ensure buyer user exists
    await queryExec(
      `INSERT INTO users (user_id, display_name, phone, active_role, roles) 
       VALUES ($1, $2, $3, 'buyer', '{"buyer"}') 
       ON CONFLICT (user_id) DO NOTHING`,
      [buyerId, buyerName, buyerPhone]
    );

    // Check if an existing procurement order exists for append / continuous sourcing
    const existingOrderRes = await queryExec(
      'SELECT * FROM procurement_orders WHERE id = $1 OR order_id = $1 FOR UPDATE',
      [id]
    );

    let finalAllocations = [];
    let allocationsToDeduct = [];
    let isAppending = false;
    let previousOrder = null;

    if (existingOrderRes.rows.length > 0) {
      previousOrder = existingOrderRes.rows[0];
      const prevStatus = (previousOrder.status || '').toUpperCase();
      if (prevStatus === 'CLOSED' || prevStatus === 'PARTIALLY_FULFILLED') {
        if (client) await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          code: 'ORDER_CLOSED',
          message: `Procurement order ${id} is already ${prevStatus} and cannot accept additional allocations.`
        });
      }

      const prevAllocations = Array.isArray(previousOrder.farmer_allocations) ? previousOrder.farmer_allocations : [];
      isAppending = true;

      // Identify newly added allocations that haven't been deducted yet
      allocationsToDeduct = incomingAllocations.filter((inAlloc) => {
        const inListingId = inAlloc.listingId || inAlloc.listing_id || inAlloc.supplierId || inAlloc.supplier_id || inAlloc.id;
        const existsAlready = prevAllocations.some((prev) => {
          const prevListingId = prev.listingId || prev.listing_id || prev.supplierId || prev.supplier_id || prev.id;
          return prevListingId === inListingId && (prev.allocatedQuantityKg === inAlloc.allocatedQuantityKg || prev.allocationIndex === inAlloc.allocationIndex);
        });
        return !existsAlready;
      });

      finalAllocations = [...prevAllocations, ...allocationsToDeduct].map((a, idx) => ({
        ...a,
        allocationIndex: idx + 1,
        paymentStatus: a.paymentStatus || 'PENDING',
        status: a.status || 'CONFIRMED'
      }));
    } else {
      allocationsToDeduct = incomingAllocations;
      finalAllocations = incomingAllocations.map((a, idx) => ({
        ...a,
        allocationIndex: idx + 1,
        paymentStatus: a.paymentStatus || 'PENDING',
        status: a.status || 'CONFIRMED'
      }));
    }

    // Validate and atomically deduct quantities from real marketplace listings
    const updatedListingsToBroadcast = [];
    const verifiedListingPriceMap = new Map();

    for (const alloc of allocationsToDeduct) {
      const listingId = alloc.listingId || alloc.listing_id || alloc.supplierId || alloc.supplier_id || alloc.id;
      const allocatedQty = Number(
        alloc.allocatedQuantityKg !== undefined 
          ? alloc.allocatedQuantityKg 
          : (alloc.allocated_quantity_kg !== undefined 
              ? alloc.allocated_quantity_kg 
              : (alloc.allocatedQuantityTonnes ? alloc.allocatedQuantityTonnes * 1000 : 0))
      );

      if (!listingId || isNaN(allocatedQty) || allocatedQty <= 0) {
        continue;
      }

      // Check if this allocation targets an existing listing in PostgreSQL
      const listingRes = await queryExec(
        'SELECT * FROM marketplace_listings WHERE id = $1 FOR UPDATE',
        [listingId]
      );

      if (listingRes.rows.length > 0) {
        const existingListing = listingRes.rows[0];
        const currentQty = Number(existingListing.quantity_kg || 0);
        const currentStatus = (existingListing.status || '').toLowerCase().trim();
        const farmerAskingPrice = Number(existingListing.asking_price || 0);
        if (farmerAskingPrice > 0) {
          verifiedListingPriceMap.set(String(listingId), farmerAskingPrice);
        }

        // Check if listing has enough available stock and is currently listed
        if (currentStatus === 'sold' || currentQty < allocatedQty || currentQty <= 0) {
          if (client) await client.query('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            code: 'INSUFFICIENT_SUPPLY',
            message: `Farmer listing "${existingListing.title || existingListing.crop_type || listingId}" has insufficient available quantity (${currentQty} kg available, ${allocatedQty} kg requested) or is already sold.`
          });
        }

        const remainingQty = Math.max(0, Number((currentQty - allocatedQty).toFixed(3)));
        const newStatus = remainingQty <= 0.0001 ? 'sold' : 'listed';
        const finalQty = remainingQty <= 0.0001 ? 0 : remainingQty;

        const updateRes = await queryExec(
          `UPDATE marketplace_listings 
           SET quantity_kg = $1, status = $2, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $3 
           RETURNING *`,
          [finalQty, newStatus, listingId]
        );

        if (updateRes.rows.length > 0) {
          updatedListingsToBroadcast.push(updateRes.rows[0]);
        }
      }
    }

    // Farmer-Led Pricing Enforcement:
    // Enforce that each allocation's pricePerKg is strictly the farmer's asking price from the database listing.
    // The buyer cannot modify, discount, negotiate, or submit an override price.
    finalAllocations = finalAllocations.map(a => {
      const listingId = String(a.listingId || a.listing_id || a.supplierId || a.supplier_id || a.id || '');
      const verifiedAskingPrice = verifiedListingPriceMap.has(listingId)
        ? verifiedListingPriceMap.get(listingId)
        : Number(a.pricePerKg || a.farmerAskingPrice || a.asking_price || 0);
      const allocKg = Number(a.allocatedQuantityKg || a.allocated_quantity_kg || (a.allocatedQuantityTonnes ? a.allocatedQuantityTonnes * 1000 : 0));
      const subtotal = Math.round(allocKg * verifiedAskingPrice);

      return {
        ...a,
        pricePerKg: verifiedAskingPrice,
        farmerAskingPrice: verifiedAskingPrice,
        farmerSubtotal: subtotal
      };
    });

    // Farmer contact phone attachment for confirmed direct coordination
    for (let i = 0; i < finalAllocations.length; i++) {
      const a = finalAllocations[i];
      const listingId = a.listingId || a.listing_id || a.supplierId || a.supplier_id || a.id;
      let fPhone = a.farmerPhone || a.phone || a.contact_phone || null;
      if (!fPhone && listingId) {
        const lRes = await queryExec('SELECT contact_phone, creator_id FROM marketplace_listings WHERE id = $1', [listingId]);
        if (lRes.rows.length > 0) {
          fPhone = lRes.rows[0].contact_phone;
          if (!fPhone && lRes.rows[0].creator_id) {
            const uRes = await queryExec('SELECT phone FROM users WHERE user_id = $1', [lRes.rows[0].creator_id]);
            if (uRes.rows.length > 0) fPhone = uRes.rows[0].phone;
          }
        }
      }
      if (!fPhone && a.farmerId) {
        const uRes = await queryExec('SELECT phone FROM users WHERE user_id = $1', [a.farmerId]);
        if (uRes.rows.length > 0) fPhone = uRes.rows[0].phone;
      }
      if (fPhone) {
        finalAllocations[i].farmerPhone = fPhone;
        finalAllocations[i].phone = fPhone;
      }
    }

    let finalBuyerPhone = buyerPhone;
    if (!finalBuyerPhone && buyerId) {
      const uRes = await queryExec('SELECT phone FROM users WHERE user_id = $1', [buyerId]);
      if (uRes.rows.length > 0 && uRes.rows[0].phone) {
        finalBuyerPhone = uRes.rows[0].phone;
      }
    }

    // Determine lifecycle status based on sourced quantity vs requested quantity
    const totalSourcedKg = finalAllocations.reduce((sum, a) => {
      const kg = Number(a.allocatedQuantityKg || a.allocated_quantity_kg || (a.allocatedQuantityTonnes ? a.allocatedQuantityTonnes * 1000 : 0));
      return sum + (isNaN(kg) ? 0 : kg);
    }, 0);

    const targetDemandKg = isAppending ? Number(previousOrder.requested_quantity_kg) : requestedQuantityKg;
    const remainingKg = Math.max(0, Number((targetDemandKg - totalSourcedKg).toFixed(3)));

    let status = body.status;
    if (!status) {
      if (totalSourcedKg === 0) {
        status = 'REQUESTED';
      } else if (totalSourcedKg < targetDemandKg) {
        status = 'PARTIALLY_SOURCED';
      } else {
        status = 'FULLY_SOURCED';
      }
    }

    const totalProduceCost = finalAllocations.reduce((sum, a) => {
      return sum + (a.farmerSubtotal ? Number(a.farmerSubtotal) : Math.round(Number(a.allocatedQuantityKg || 0) * Number(a.pricePerKg || 0)));
    }, 0);

    const averageProducePrice = totalSourcedKg > 0 ? Number((totalProduceCost / totalSourcedKg).toFixed(2)) : 0;
    const fulfilmentPercentage = targetDemandKg > 0 ? Math.min(100, Math.round((totalSourcedKg / targetDemandKg) * 100)) : 100;

    const procurementSummary = {
      ...summaryObj,
      buyerType,
      intendedUse,
      qualityGrade,
      requestedQuantityKg: targetDemandKg,
      sourcedQuantityKg: totalSourcedKg,
      remainingQuantityKg: remainingKg,
      totalQuantityKg: totalSourcedKg,
      totalQuantityTonnes: Number((totalSourcedKg / 1000).toFixed(3)),
      totalProduceCost,
      averageProducePrice,
      fulfilmentPercentage,
      totalSuppliersCount: finalAllocations.length,
      paymentStatus: 'PENDING'
    };

    const sql = `
      INSERT INTO procurement_orders (
        id, order_id, buyer_id, buyer_name, buyer_phone,
        crop, category, requested_quantity_kg, quality_grade, required_date,
        max_price_per_kg, delivery_location, delivery_latitude, delivery_longitude,
        status, order_type, match_type, farmer_allocations, procurement_summary,
        notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18, $19,
        $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        buyer_name = EXCLUDED.buyer_name,
        buyer_phone = EXCLUDED.buyer_phone,
        crop = EXCLUDED.crop,
        requested_quantity_kg = EXCLUDED.requested_quantity_kg,
        quality_grade = EXCLUDED.quality_grade,
        required_date = EXCLUDED.required_date,
        max_price_per_kg = EXCLUDED.max_price_per_kg,
        delivery_location = EXCLUDED.delivery_location,
        status = EXCLUDED.status,
        farmer_allocations = EXCLUDED.farmer_allocations,
        procurement_summary = EXCLUDED.procurement_summary,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      id, orderId, buyerId, buyerName, finalBuyerPhone,
      crop, category, targetDemandKg, qualityGrade, requiredDate,
      maxPricePerKg, deliveryLocation, deliveryLatitude, deliveryLongitude,
      status, orderType, matchType, JSON.stringify(finalAllocations), JSON.stringify(procurementSummary),
      notes
    ];

    const result = await queryExec(sql, values);
    const createdOrder = result.rows[0];

    if (client) {
      await client.query('COMMIT');
    }

    // Real-time broadcasts
    try {
      if (isAppending) {
        broadcastProcurementOrderUpdated(createdOrder);
      } else {
        broadcastProcurementOrderCreated(createdOrder);
      }
    } catch (wsErr) {
      console.warn('[Procurement Socket] Broadcast order error:', wsErr);
    }

    for (const updatedListing of updatedListingsToBroadcast) {
      try {
        broadcastListingUpdated(updatedListing);
      } catch (wsErr) {
        console.warn('[Procurement Socket] Broadcast listing update error:', wsErr);
      }
    }

    res.status(201).json({
      status: 'success',
      data: filterOrderContactVisibility(createdOrder, requesterId)
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Update procurement order status or extend required_date
 */
export async function updateProcurementOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, notes, required_date } = req.body;

    if (!id || (!status && !required_date)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Order ID and new status or required_date are required'
      });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (status) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (notes) {
      fields.push(`notes = $${idx++}`);
      values.push(notes);
    }
    if (required_date) {
      fields.push(`required_date = $${idx++}`);
      values.push(required_date);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const idParam = `$${idx++}`;

    const result = await query(
      `UPDATE procurement_orders 
       SET ${fields.join(', ')} 
       WHERE id = ${idParam} OR order_id = ${idParam} 
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Procurement order with ID "${id}" not found`
      });
    }

    const updatedOrder = result.rows[0];

    // Real-time broadcast
    try {
      broadcastProcurementOrderUpdated(updatedOrder);
    } catch (wsErr) {
      console.warn('[Procurement Socket] Broadcast error:', wsErr);
    }

    res.status(200).json({
      status: 'success',
      data: updatedOrder
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Simulate payment completion for a procurement order
 * Requires transport details to be arranged by the buyer before payment.
 * Preserves farmer asking price and locks the 3% platform fee formula.
 */
export async function simulateProcurementPayment(req, res, next) {
  try {
    const { id } = req.params;
    const { payment_method = "UPI", payment_reference } = req.body || {};

    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Order ID is required'
      });
    }

    const orderRes = await query(
      'SELECT * FROM procurement_orders WHERE id = $1 OR order_id = $1 LIMIT 1',
      [id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Procurement order with ID "${id}" not found`
      });
    }

    const existingOrder = orderRes.rows[0];
    const prevSummary = existingOrder.procurement_summary || {};
    const allocations = Array.isArray(existingOrder.farmer_allocations) ? existingOrder.farmer_allocations : [];
    const existingLogistics = existingOrder.logistics || prevSummary.logistics;

    // Requirement: Transport details must exist BEFORE payment
    if (!existingLogistics || !existingLogistics.transporterName || !existingLogistics.vehicleNumber) {
      return res.status(400).json({
        status: 'error',
        code: 'TRANSPORT_REQUIRED',
        message: 'Transport details must be arranged before completing procurement payment.'
      });
    }

    // Calculate crop value strictly on confirmed allocations (Confirmed Quantity × Farmer Asking Price)
    const cropValue = allocations.reduce((sum, a) => {
      const kg = Number(a.allocatedQuantityKg || a.allocated_quantity_kg || 0);
      const price = Number(a.pricePerKg || 0);
      return sum + (a.farmerSubtotal ? Number(a.farmerSubtotal) : Math.round(kg * price));
    }, 0) || Number(prevSummary.totalProduceCost || 0);

    // Business Formula:
    // Platform Fee Base = Crop Value - Rejection Risk
    // Platform Fee = 3% * Platform Fee Base
    // Net Procurement Value = Crop Value - Rejection Risk - Platform Fee
    const PLATFORM_FEE_RATE = 0.03;
    const risk = Math.max(0, Number(req.body?.rejection_risk !== undefined ? req.body.rejection_risk : (req.body?.rejectionRisk !== undefined ? req.body.rejectionRisk : (prevSummary.rejectionRisk ?? prevSummary.rejection_risk ?? 0))));
    const platformFeeBase = Math.max(0, cropValue - risk);
    const platformFee = Math.round(platformFeeBase * PLATFORM_FEE_RATE);
    const netProcurementValue = Math.max(0, cropValue - risk - platformFee);
    const transportCost = Number(existingLogistics?.transportCost || 0);
    const totalBuyerPayable = netProcurementValue + transportCost;

    const generatedRef = payment_reference || `SIM-PAY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const nowIso = new Date().toISOString();

    // Update allocations paymentStatus to PAID_SIMULATED
    const updatedAllocations = allocations.map(a => ({
      ...a,
      paymentStatus: 'PAID_SIMULATED'
    }));

    // Update logistics timeline with PAYMENT_COMPLETED event
    const timeline = Array.isArray(existingLogistics.timeline) ? [...existingLogistics.timeline] : [];
    if (!timeline.some(t => t.status === 'PAID')) {
      timeline.push({
        status: 'PAID',
        label: 'Payment Completed',
        timestamp: nowIso,
        notes: `Simulated payment recorded (${payment_method}) • Ref: ${generatedRef}`
      });
    }

    const updatedLogistics = {
      ...existingLogistics,
      transportStatus: existingLogistics.transportStatus || 'ASSIGNED',
      updatedAt: nowIso,
      timeline
    };

    const updatedSummary = {
      ...prevSummary,
      cropValue,
      rejectionRisk: risk,
      platformFeeBase,
      platformFee,
      platformFeeRate: PLATFORM_FEE_RATE,
      netProcurementValue,
      transportCost,
      totalBuyerPayable,
      paymentStatus: 'PAID_SIMULATED',
      paymentMethod: payment_method,
      paymentReference: generatedRef,
      paidAt: nowIso,
      amountPaid: netProcurementValue,
      logistics: updatedLogistics,
      logisticsStatus: 'ASSIGNED'
    };

    const newOrderStatus = 'READY_FOR_PICKUP';

    const updateRes = await query(
      `UPDATE procurement_orders 
       SET status = $1, farmer_allocations = $2, procurement_summary = $3, logistics = $4, logistics_status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 OR order_id = $5 
       RETURNING *`,
      [newOrderStatus, JSON.stringify(updatedAllocations), JSON.stringify(updatedSummary), JSON.stringify(updatedLogistics), id]
    );

    const updatedOrder = updateRes.rows[0];

    // Real-time broadcast
    try {
      broadcastProcurementOrderUpdated(updatedOrder);
    } catch (wsErr) {
      console.warn('[Procurement Socket] Broadcast payment error:', wsErr);
    }

    const requesterId = req.headers['x-user-id'] || req.headers['X-User-Id'] || req.query.user_id;

    res.status(200).json({
      status: 'success',
      data: filterOrderContactVisibility(updatedOrder, requesterId)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Arrange Transport for Confirmed Procurement Order (BEFORE payment)
 * Transport cost is stored as logistics metadata only (never modifies farmer asking price or platform fee).
 */
export async function arrangeTransportDetails(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const requesterId = req.headers['x-user-id'] || req.headers['X-User-Id'];

    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Order ID is required'
      });
    }

    const orderRes = await query(
      'SELECT * FROM procurement_orders WHERE id = $1 OR order_id = $1 LIMIT 1',
      [id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Procurement order with ID "${id}" not found`
      });
    }

    const order = orderRes.rows[0];
    const summary = order.procurement_summary || {};
    const prevLogistics = order.logistics || summary.logistics || {};

    // Access control: only the buyer or authorized user can arrange transport (farmers are read-only)
    if (requesterId && (requesterId === 'usr_farmer' || requesterId.includes('farmer'))) {
      return res.status(403).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Farmers have read-only access to transport details. Transport is arranged by the buyer.'
      });
    }

    const transporterName = String(body.transporterName || body.transporter_name || body.companyName || '').trim();
    const transporterPhone = String(body.transporterPhone || body.transporter_phone || body.companyPhone || '').trim();
    const driverName = String(body.driverName || body.driver_name || '').trim();
    const driverPhone = String(body.driverPhone || body.driver_phone || '').trim();
    const vehicleNumber = String(body.vehicleNumber || body.vehicle_number || '').trim();
    const pickupDate = String(body.pickupDate || body.pickup_date || '').trim();
    const pickupTime = String(body.pickupTime || body.pickup_time || '').trim();
    const destination = String(body.destination || body.destinationCity || order.delivery_location || 'Madurai').trim();
    const transportCost = Number(body.transportCost !== undefined ? body.transportCost : (body.transport_cost || 0));

    // Optional real GPS coordinates
    const gpsLat = body.gpsLatitude !== undefined ? body.gpsLatitude : (body.gps_latitude !== undefined ? body.gps_latitude : null);
    const gpsLon = body.gpsLongitude !== undefined ? body.gpsLongitude : (body.gps_longitude !== undefined ? body.gps_longitude : null);

    if (!transporterName || !driverName || !vehicleNumber) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Transporter name, driver name, and vehicle number are required.'
      });
    }

    const nowIso = new Date().toISOString();
    const timeline = Array.isArray(prevLogistics.timeline) && prevLogistics.timeline.length > 0 
      ? [...prevLogistics.timeline] 
      : [{ status: 'ASSIGNED', label: 'Transport Assigned', timestamp: nowIso, notes: `Vehicle ${vehicleNumber} arranged with ${transporterName}` }];

    const logisticsData = {
      transportStatus: prevLogistics.transportStatus || 'ASSIGNED',
      transporterName,
      transporterPhone: transporterPhone || null,
      driverName,
      driverPhone: driverPhone || null,
      vehicleNumber,
      pickupDate: pickupDate || new Date().toISOString().split('T')[0],
      pickupTime: pickupTime || '10:00 AM',
      destination,
      transportCost: isNaN(transportCost) ? 0 : Math.max(0, transportCost),
      gpsLatitude: (gpsLat !== null && !isNaN(Number(gpsLat))) ? Number(gpsLat) : (prevLogistics.gpsLatitude ?? null),
      gpsLongitude: (gpsLon !== null && !isNaN(Number(gpsLon))) ? Number(gpsLon) : (prevLogistics.gpsLongitude ?? null),
      lastGpsUpdate: (gpsLat !== null && gpsLon !== null) ? nowIso : (prevLogistics.lastGpsUpdate ?? null),
      notes: body.notes || null,
      assignedAt: prevLogistics.assignedAt || nowIso,
      updatedAt: nowIso,
      timeline
    };

    const updatedSummary = {
      ...summary,
      logistics: logisticsData,
      logisticsStatus: logisticsData.transportStatus
    };

    const updateRes = await query(
      `UPDATE procurement_orders 
       SET logistics = $1, logistics_status = $2, procurement_summary = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 OR order_id = $4 
       RETURNING *`,
      [JSON.stringify(logisticsData), logisticsData.transportStatus, JSON.stringify(updatedSummary), id]
    );

    const updatedOrder = updateRes.rows[0];

    // Real-time broadcast so farmer sees transport details live
    try {
      broadcastProcurementOrderUpdated(updatedOrder);
    } catch (wsErr) {
      console.warn('[Procurement Socket] Broadcast error:', wsErr);
    }

    res.status(200).json({
      status: 'success',
      data: filterOrderContactVisibility(updatedOrder, requesterId)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update Logistics Status (ASSIGNED -> PICKUP -> COLLECTED -> IN TRANSIT -> DELIVERED)
 */
export async function updateLogisticsStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, notes, gpsLatitude, gps_latitude, gpsLongitude, gps_longitude } = req.body || {};
    const requesterId = req.headers['x-user-id'] || req.headers['X-User-Id'];

    const VALID_STATUSES = ['ASSIGNED', 'PICKUP', 'COLLECTED', 'IN TRANSIT', 'DELIVERED'];
    const normStatus = String(status || '').toUpperCase().trim();

    if (!VALID_STATUSES.includes(normStatus)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_STATUS',
        message: `Invalid logistics status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    const orderRes = await query(
      'SELECT * FROM procurement_orders WHERE id = $1 OR order_id = $1 LIMIT 1',
      [id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Procurement order with ID "${id}" not found`
      });
    }

    const order = orderRes.rows[0];
    const existingLogistics = order.logistics || order.procurement_summary?.logistics;

    if (!existingLogistics) {
      return res.status(400).json({
        status: 'error',
        code: 'LOGISTICS_NOT_ASSIGNED',
        message: 'Transport details have not been arranged yet for this order.'
      });
    }

    // Access control: only the buyer can advance logistics status
    if (requesterId && (requesterId === 'usr_farmer' || requesterId.includes('farmer'))) {
      return res.status(403).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Farmers have read-only access to logistics status updates.'
      });
    }

    const nowIso = new Date().toISOString();
    const timeline = Array.isArray(existingLogistics.timeline) ? [...existingLogistics.timeline] : [];
    
    // Status labels
    const STATUS_LABELS = {
      ASSIGNED: 'Transport Assigned',
      PICKUP: 'Pickup Scheduled',
      COLLECTED: 'Produce Collected from Farmer',
      'IN TRANSIT': 'In Transit to Destination Hub',
      DELIVERED: 'Produce Delivered to Buyer'
    };

    timeline.push({
      status: normStatus,
      label: STATUS_LABELS[normStatus] || normStatus,
      timestamp: nowIso,
      notes: notes || null
    });

    const rawLat = gpsLatitude !== undefined ? gpsLatitude : (gps_latitude !== undefined ? gps_latitude : null);
    const rawLon = gpsLongitude !== undefined ? gpsLongitude : (gps_longitude !== undefined ? gps_longitude : null);
    const hasNewGps = rawLat !== null && rawLon !== null && !isNaN(Number(rawLat)) && !isNaN(Number(rawLon));

    const updatedLogistics = {
      ...existingLogistics,
      transportStatus: normStatus,
      gpsLatitude: hasNewGps ? Number(rawLat) : (existingLogistics.gpsLatitude ?? null),
      gpsLongitude: hasNewGps ? Number(rawLon) : (existingLogistics.gpsLongitude ?? null),
      lastGpsUpdate: hasNewGps ? nowIso : (existingLogistics.lastGpsUpdate ?? null),
      updatedAt: nowIso,
      timeline
    };

    const updatedSummary = {
      ...(order.procurement_summary || {}),
      logistics: updatedLogistics,
      logisticsStatus: normStatus
    };

    const updateRes = await query(
      `UPDATE procurement_orders 
       SET logistics = $1, logistics_status = $2, procurement_summary = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 OR order_id = $4 
       RETURNING *`,
      [JSON.stringify(updatedLogistics), normStatus, JSON.stringify(updatedSummary), id]
    );

    const updatedOrder = updateRes.rows[0];

    // Real-time broadcast to farmer and buyer
    try {
      broadcastProcurementOrderUpdated(updatedOrder);
    } catch (wsErr) {
      console.warn('[Procurement Socket] Broadcast error:', wsErr);
    }

    res.status(200).json({
      status: 'success',
      data: filterOrderContactVisibility(updatedOrder, requesterId)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update Genuine Live GPS Coordinates for Transport Vehicle
 * Never creates dummy movement or fake coordinates.
 */
export async function updateLogisticsGps(req, res, next) {
  try {
    const { id } = req.params;
    const requesterId = req.headers['x-user-id'] || req.headers['X-User-Id'] || req.query.user_id;
    const { latitude, longitude, speedKmH, heading } = req.body || {};

    if (!id || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Order ID, latitude, and longitude are required for GPS update.'
      });
    }

    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_COORDINATES',
        message: 'Latitude and longitude must be valid numbers.'
      });
    }

    const orderRes = await query(
      'SELECT * FROM procurement_orders WHERE id = $1 OR order_id = $1 LIMIT 1',
      [id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Procurement order with ID "${id}" not found`
      });
    }

    const order = orderRes.rows[0];
    const existingLogistics = order.logistics || order.procurement_summary?.logistics;

    if (!existingLogistics) {
      return res.status(400).json({
        status: 'error',
        code: 'LOGISTICS_NOT_ASSIGNED',
        message: 'Transport details have not been arranged yet for this order.'
      });
    }

    const nowIso = new Date().toISOString();
    const updatedLogistics = {
      ...existingLogistics,
      gpsLatitude: lat,
      gpsLongitude: lon,
      speedKmH: speedKmH !== undefined ? Number(speedKmH) : (existingLogistics.speedKmH ?? null),
      heading: heading || (existingLogistics.heading ?? null),
      lastGpsUpdate: nowIso,
      updatedAt: nowIso
    };

    const updatedSummary = {
      ...(order.procurement_summary || {}),
      logistics: updatedLogistics
    };

    const updateRes = await query(
      `UPDATE procurement_orders 
       SET logistics = $1, procurement_summary = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 OR order_id = $3 
       RETURNING *`,
      [JSON.stringify(updatedLogistics), JSON.stringify(updatedSummary), id]
    );

    const updatedOrder = updateRes.rows[0];

    try {
      broadcastProcurementOrderUpdated(updatedOrder);
    } catch (wsErr) {
      console.warn('[Procurement Socket] Broadcast error:', wsErr);
    }

    res.status(200).json({
      status: 'success',
      data: filterOrderContactVisibility(updatedOrder, requesterId)
    });
  } catch (err) {
    next(err);
  }
}


