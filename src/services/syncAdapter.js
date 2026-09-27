/**
 * AgroCycle Synchronization Adapters
 * 
 * Defines the contract for processing offline queued actions.
 * Integrates FutureRemoteSyncAdapter with the PostgreSQL REST API gateway (/api/v1/sync/:entityType)
 * while preserving LocalMockSyncAdapter as a development and offline fallback.
 */

import * as db from "./indexedDB.js";
import { STORES } from "./indexedDB.js";
import { ACTION_TYPES } from "./syncQueue.js";

/**
 * Base Synchronization Adapter Interface
 */
export class BaseSyncAdapter {
  /**
   * Process a queued action
   * @param {Object} action - Action queue record
   * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
   */
  async syncAction(action) {
    throw new Error("syncAction() must be implemented by subclass");
  }

  resolveStoreName(entityType, actionType) {
    const clean = String(entityType || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (clean.includes("user")) return STORES.USERS;
    if (clean.includes("location") || clean.includes("farm")) return STORES.USER_LOCATIONS;
    if (clean.includes("market") || clean.includes("waste")) return STORES.MARKETPLACE_LISTINGS;
    if (clean.includes("scan") || clean.includes("assessment")) return STORES.SCAN_HISTORY;
    if (clean.includes("silagebook")) return STORES.SILAGE_BOOKINGS;
    if (clean.includes("silagecenter")) return STORES.SILAGE_CENTERS;
    if (clean.includes("carbonact") || clean.includes("carbonlog")) return STORES.CARBON_ACTIVITIES;
    if (clean.includes("carbonoffer")) return STORES.CARBON_OFFERS;
    if (clean.includes("claim") || clean.includes("insurance")) return STORES.CLAIM_DOSSIERS;
    if (clean.includes("agro") || clean.includes("croppost")) return STORES.AGRO_CONNECT;
    if (clean.includes("notif")) return STORES.NOTIFICATIONS;
    return null;
  }

  syncLocalStorageMirror(storeName, entityId, updatedRecord) {
    if (typeof localStorage === "undefined") return;
    
    const updateListInKey = (key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          let found = false;
          const updated = list.map(item => {
            if (item && String(item.id) === String(entityId)) {
              found = true;
              return { ...item, sync_status: "synced", synced_at: updatedRecord.synced_at };
            }
            return item;
          });
          if (found) {
            localStorage.setItem(key, JSON.stringify(updated));
          }
        }
      } catch (e) {}
    };

    switch (storeName) {
      case STORES.AGRO_CONNECT:
        updateListInKey("agroPosts");
        updateListInKey("agrocycle_mock_CropPost");
        break;
      case STORES.MARKETPLACE_LISTINGS:
        updateListInKey("wastePosts");
        updateListInKey("agrocycle_mock_WasteMatch");
        break;
      case STORES.SILAGE_BOOKINGS:
        updateListInKey("silageBookings");
        break;
      case STORES.SILAGE_CENTERS:
        updateListInKey("silageCenters");
        break;
      case STORES.CARBON_ACTIVITIES:
        updateListInKey("carbonLogs");
        updateListInKey("agrocycle_mock_CarbonActivity");
        break;
      case STORES.CARBON_OFFERS:
        updateListInKey("carbonOffers");
        break;
      case STORES.CLAIM_DOSSIERS:
        updateListInKey("claims");
        updateListInKey("agrocycle_mock_InsuranceClaim");
        break;
      case STORES.SCAN_HISTORY:
        updateListInKey("agrocycle_mock_ViabilityScan");
        break;
      case STORES.NOTIFICATIONS:
        updateListInKey("agrocycle_mock_Notification");
        break;
    }
  }
}

/**
 * Local / Mock Synchronization Adapter (Offline / Testing Fallback)
 */
export class LocalMockSyncAdapter extends BaseSyncAdapter {
  constructor({ simulateDelayMs = 250, simulateFailureRate = 0 } = {}) {
    super();
    this.simulateDelayMs = simulateDelayMs;
    this.simulateFailureRate = simulateFailureRate;
  }

  async syncAction(action) {
    if (this.simulateDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulateDelayMs));
    }

    if (this.simulateFailureRate > 0 && Math.random() < this.simulateFailureRate) {
      throw new Error("Temporary network timeout during sync");
    }

    const { actionType, entityType, entityId, userId, payload } = action;
    const storeName = this.resolveStoreName(entityType, actionType);

    if (storeName) {
      let record = await db.get(storeName, entityId);
      if (!record && payload) {
        record = { ...payload, id: entityId };
      }

      if (record) {
        const updatedRecord = {
          ...record,
          sync_status: "synced",
          synced_at: new Date().toISOString()
        };
        await db.put(storeName, updatedRecord);
        this.syncLocalStorageMirror(storeName, entityId, updatedRecord);
      }
    }

    return {
      success: true,
      target: "local_mock_storage",
      syncedAt: new Date().toISOString(),
      entityId
    };
  }
}

/**
 * Remote Synchronization Adapter (Connected to PostgreSQL REST API)
 */
export class FutureRemoteSyncAdapter extends BaseSyncAdapter {
  constructor({ apiBaseUrl, getAuthToken } = {}) {
    super();
    let envBase = "";
    try {
      if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) {
        envBase = import.meta.env.VITE_API_BASE_URL;
      }
    } catch (e) {}

    this.apiBaseUrl = apiBaseUrl || envBase || "http://localhost:5000/api/v1";
    this.getAuthToken = getAuthToken || (() => null);
  }

  async syncAction(action) {
    const token = await this.getAuthToken();
    const cleanEntityType = String(action.entityType || "generic")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const endpoint = `${this.apiBaseUrl}/sync/${cleanEntityType}`;
    const idempotencyKey = action.idempotencyKey || `${action.userId}_${action.actionType}_${action.entityId}`;

    const headers = {
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        actionType: action.actionType,
        entityId: action.entityId,
        userId: action.userId,
        payload: action.payload,
        clientCreatedAt: action.createdAt
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Remote API sync failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Update local record in IndexedDB with synchronized status
    const storeName = this.resolveStoreName(action.entityType, action.actionType);
    if (storeName) {
      try {
        let record = await db.get(storeName, action.entityId);
        if (!record && action.payload) {
          record = { ...action.payload, id: action.entityId };
        }
        if (record) {
          const updatedRecord = {
            ...record,
            sync_status: "synced",
            synced_at: data.timestamp || new Date().toISOString()
          };
          await db.put(storeName, updatedRecord);
          this.syncLocalStorageMirror(storeName, action.entityId, updatedRecord);
        }
      } catch (err) {
        console.warn("[RemoteSyncAdapter] Local IndexedDB update warning:", err);
      }
    }

    return {
      success: true,
      target: "remote_api",
      entityId: action.entityId,
      syncedAt: data.timestamp || new Date().toISOString(),
      serverData: data
    };
  }
}

// Export active default adapter instance
export const defaultSyncAdapter = new FutureRemoteSyncAdapter();
