/**
 * AgroCycle Offline Action Queue Service
 * 
 * Manages persistent action queuing in IndexedDB for offline-first operations.
 * Implements strict idempotency, account isolation, and retry state tracking.
 */

import * as db from "./indexedDB.js";
import { STORES } from "./indexedDB.js";

export const ACTION_TYPES = {
  SAVE_USER_PROFILE: "SAVE_USER_PROFILE",
  SAVE_LOCATION: "SAVE_LOCATION",
  SAVE_FIELD_ASSESSMENT: "SAVE_FIELD_ASSESSMENT",
  CREATE_MARKETPLACE_LISTING: "CREATE_MARKETPLACE_LISTING",
  UPDATE_MARKETPLACE_LISTING: "UPDATE_MARKETPLACE_LISTING",
  SAVE_BUYER_REQUIREMENT: "SAVE_BUYER_REQUIREMENT",
  SAVE_SILAGE_CENTER: "SAVE_SILAGE_CENTER",
  CREATE_SILAGE_BOOKING: "CREATE_SILAGE_BOOKING",
  UPDATE_SILAGE_BOOKING: "UPDATE_SILAGE_BOOKING",
  CREATE_AGROCONNECT_POST: "CREATE_AGROCONNECT_POST",
  CREATE_CARBON_ACTIVITY: "CREATE_CARBON_ACTIVITY",
  SPONSOR_CARBON_ACTIVITY: "SPONSOR_CARBON_ACTIVITY",
  SAVE_CARBON_OFFER: "SAVE_CARBON_OFFER",
  UPDATE_CARBON_ACTIVITY: "UPDATE_CARBON_ACTIVITY",
  SAVE_CLAIM_DOSSIER: "SAVE_CLAIM_DOSSIER",
  SAVE_NOTIFICATION: "SAVE_NOTIFICATION",
  UPDATE_NOTIFICATION: "UPDATE_NOTIFICATION",
  CREATE_LOGISTICS_SHIPMENT: "CREATE_LOGISTICS_SHIPMENT",
  UPDATE_LOGISTICS_SHIPMENT_STATUS: "UPDATE_LOGISTICS_SHIPMENT_STATUS"
};

export const SYNC_STATUS = {
  PENDING: "pending",
  SYNCING: "syncing",
  SYNCED: "synced",
  FAILED: "failed"
};

export const MAX_RETRIES = 3;

/**
 * Enqueue a new action for synchronization
 * 
 * @param {Object} params
 * @param {string} params.userId - Canonical user ID (owner)
 * @param {string} params.actionType - Action type constant
 * @param {string} params.entityType - Target entity store name / model
 * @param {string} params.entityId - Primary key of target local record
 * @param {Object} params.payload - Complete record data payload
 * @param {string} [params.idempotencyKey] - Optional custom idempotency key
 * @returns {Promise<Object>} The enqueued action item
 */
export async function enqueueAction({
  userId,
  actionType,
  entityType,
  entityId,
  payload = {},
  idempotencyKey = null
}) {
  if (!userId) {
    throw new Error("[SyncQueue] Action cannot be queued without a canonical userId");
  }
  if (!actionType || !entityType || !entityId) {
    throw new Error("[SyncQueue] Action requires actionType, entityType, and entityId");
  }

  // Generate deterministic idempotency key if not explicitly supplied
  const key = idempotencyKey || `${userId}_${actionType}_${entityId}`;

  // Idempotency check: check if an action with this key already exists
  const existing = await getByIdempotencyKey(key);
  if (existing) {
    // If existing action is already synced or currently pending, avoid creating a duplicate
    if (existing.status === SYNC_STATUS.SYNCED || existing.status === SYNC_STATUS.PENDING || existing.status === SYNC_STATUS.SYNCING) {
      return existing;
    }
  }

  const queueItem = {
    id: `sq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: String(userId),
    actionType,
    entityType,
    entityId: String(entityId),
    payload: JSON.parse(JSON.stringify(payload)),
    createdAt: new Date().toISOString(),
    status: SYNC_STATUS.PENDING,
    retryCount: 0,
    lastAttemptAt: null,
    error: null,
    idempotencyKey: key
  };

  await db.put(STORES.SYNC_QUEUE, queueItem);
  return queueItem;
}

/**
 * Retrieve an action by its unique idempotency key
 */
export async function getByIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) return null;
  try {
    const matches = await db.getByIndex(STORES.SYNC_QUEUE, "idempotencyKey", idempotencyKey);
    return matches && matches.length > 0 ? matches[0] : null;
  } catch (err) {
    const all = await db.getAll(STORES.SYNC_QUEUE);
    return all.find(item => item.idempotencyKey === idempotencyKey) || null;
  }
}

/**
 * Retrieve pending actions ordered by creation date ascending (FIFO)
 * Strictly filters by userId if provided to preserve account isolation.
 * 
 * @param {string|null} userId
 * @returns {Promise<Array>}
 */
export async function getPendingActions(userId = null) {
  let all = [];
  try {
    if (userId) {
      all = await db.getByIndex(STORES.SYNC_QUEUE, "userId", String(userId));
    } else {
      all = await db.getAll(STORES.SYNC_QUEUE);
    }
  } catch (err) {
    all = await db.getAll(STORES.SYNC_QUEUE);
    if (userId) {
      all = all.filter(a => a.userId === String(userId));
    }
  }

  const pending = all.filter(item => 
    item.status === SYNC_STATUS.PENDING || 
    (item.status === SYNC_STATUS.FAILED && item.retryCount < MAX_RETRIES)
  );

  // Sort ascending by creation timestamp (FIFO queue)
  pending.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return pending;
}

/**
 * Retrieve all queue entries for a user (strict account isolation)
 * 
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getUserQueue(userId) {
  if (!userId) return [];
  try {
    const items = await db.getByIndex(STORES.SYNC_QUEUE, "userId", String(userId));
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    const all = await db.getAll(STORES.SYNC_QUEUE);
    return all.filter(a => a.userId === String(userId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

/**
 * Update the sync status, error, and retry metadata of an action
 * 
 * @param {string} actionId
 * @param {string} status - One of SYNC_STATUS
 * @param {string|null} error - Error message if failed
 * @returns {Promise<Object>}
 */
export async function updateActionStatus(actionId, status, error = null, retryCount = null) {
  const existing = await db.get(STORES.SYNC_QUEUE, actionId);
  if (!existing) {
    throw new Error(`[SyncQueue] Action "${actionId}" not found`);
  }

  const updates = {
    status,
    lastAttemptAt: new Date().toISOString(),
    error: error ? String(error) : null
  };

  if (retryCount !== null && retryCount !== undefined) {
    updates.retryCount = retryCount;
  } else if (status === SYNC_STATUS.FAILED) {
    updates.retryCount = (existing.retryCount || 0) + 1;
  } else if (status === SYNC_STATUS.SYNCED) {
    updates.error = null;
  }

  const updated = { ...existing, ...updates };
  await db.put(STORES.SYNC_QUEUE, updated);
  return updated;
}

/**
 * Remove an action from the queue
 */
export async function removeAction(actionId) {
  return db.remove(STORES.SYNC_QUEUE, actionId);
}

/**
 * Reset a failed action so it can be retried
 */
export async function resetActionForRetry(actionId) {
  const existing = await db.get(STORES.SYNC_QUEUE, actionId);
  if (!existing) return null;
  const updated = {
    ...existing,
    status: SYNC_STATUS.PENDING,
    retryCount: 0,
    error: null
  };
  await db.put(STORES.SYNC_QUEUE, updated);
  return updated;
}

/**
 * Clear actions for a user
 */
export async function clearUserQueue(userId) {
  const userActions = await getUserQueue(userId);
  for (const action of userActions) {
    await db.remove(STORES.SYNC_QUEUE, action.id);
  }
}
