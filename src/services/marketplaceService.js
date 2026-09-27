/**
 * AgroCycle Marketplace Service
 *
 * Provides shared backend synchronization with PostgreSQL as the persistent source of truth,
 * with IndexedDB / localDB as an offline cache and draft layer.
 */

import { localDB, KEYS } from './localDB';
import * as db from './indexedDB';
import { STORES } from './indexedDB';
import { enqueueAction, ACTION_TYPES } from './syncQueue';
import { syncManager } from './syncManager';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:5000/api/v1';

/**
 * Standardizes backend database record into consistent frontend marketplace model
 */
export function normalizeListing(raw) {
  if (!raw) return null;
  const isBuyerListing = raw.creator_role === 'buyer' || raw.creatorRole === 'buyer' || raw.listingType === 'buy' || Boolean(raw.buyerPhone);

  return {
    id: String(raw.id || `wp_${Date.now()}`),
    creatorId: raw.creator_id || raw.creatorId || null,
    creatorRole: raw.creator_role || raw.creatorRole || (isBuyerListing ? 'buyer' : 'farmer'),
    creatorName: raw.farmer_name || raw.farmerName || raw.creator_name || raw.creatorName || raw.user || 'User',
    creatorPhone: raw.contact_phone || raw.contactPhone || raw.phone || raw.creatorPhone,
    creatorVerificationStatus: raw.creatorVerificationStatus || raw.verification_status || 'verified',

    listingType: isBuyerListing ? 'buy' : 'sell',
    buyerId: isBuyerListing ? (raw.creator_id || raw.buyerId) : null,
    buyerName: isBuyerListing ? (raw.farmer_name || raw.buyerName || raw.creatorName) : null,
    buyerPhone: isBuyerListing ? (raw.contact_phone || raw.buyerPhone || raw.phone) : null,

    farmerName: !isBuyerListing ? (raw.farmer_name || raw.farmerName || raw.creatorName) : null,
    farmerPhone: !isBuyerListing ? (raw.contact_phone || raw.farmerPhone || raw.phone) : null,

    title: raw.title || `${raw.crop_type || raw.crop} Crop Waste`,
    crop: raw.crop_type || raw.crop,
    crop_type: raw.crop_type || raw.crop,
    quantity_kg: Number(raw.quantity_kg !== undefined ? raw.quantity_kg : (raw.quantity !== undefined ? raw.quantity : 100)),
    condition: raw.condition || 'damaged',
    location: raw.location || 'Local Farm',
    latitude: raw.latitude !== undefined ? raw.latitude : null,
    longitude: raw.longitude !== undefined ? raw.longitude : null,
    district: raw.district || null,
    state: raw.state || null,

    asking_price: Number(raw.asking_price !== undefined ? raw.asking_price : (raw.price !== undefined ? raw.price : 0)),
    status: raw.status || 'listed',
    image: raw.image_url || raw.image || null,
    image_url: raw.image_url || raw.image || null,
    date: raw.created_at || raw.date || new Date().toISOString(),
    created_date: raw.created_at || raw.date || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString(),

    sourceAssessmentId: raw.source_assessment_id || raw.sourceAssessmentId || null,
    source: raw.source || (raw.source_assessment_id || raw.sourceAssessmentId ? 'viability-scanner' : 'manual'),
    sync_status: raw.sync_status || 'synced'
  };
}

/**
 * Merges or updates an item in an array using persistent `id` as unique key (Deduplication)
 */
export function deduplicateAndMerge(existingList, newItem) {
  if (!newItem || !newItem.id) return existingList;
  const normalized = normalizeListing(newItem);
  const index = existingList.findIndex(item => String(item.id) === String(normalized.id));

  if (index >= 0) {
    const updated = [...existingList];
    updated[index] = { ...updated[index], ...normalized };
    return updated;
  } else {
    return [normalized, ...existingList];
  }
}

class MarketplaceService {
  /**
   * Check backend API and Database health
   */
  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE_URL}/health/db`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        return {
          backend: data.backend || 'ok',
          database: data.database || (data.connected ? 'connected' : 'disconnected'),
          connected: Boolean(data.connected)
        };
      }
      return { backend: 'error', database: 'disconnected', connected: false };
    } catch (e) {
      return { backend: 'offline', database: 'disconnected', connected: false };
    }
  }

  /**
   * Fetch all listings from shared backend with offline IndexedDB fallback
   */
  async fetchListings(params = {}) {
    let serverListings = [];
    let isOffline = false;

    try {
      const queryParams = new URLSearchParams();
      if (params.crop_type) queryParams.set('crop_type', params.crop_type);
      if (params.status) queryParams.set('status', params.status);
      if (params.creator_id) queryParams.set('creator_id', params.creator_id);
      queryParams.set('limit', params.limit || '100');

      const url = `${API_BASE_URL}/marketplace/listings?${queryParams.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (response.ok) {
        const json = await response.json();
        if (Array.isArray(json.data)) {
          serverListings = json.data.map(normalizeListing);

          // Update local IndexedDB and localStorage cache
          try {
            await db.bulkPut(STORES.MARKETPLACE_LISTINGS, serverListings);
          } catch (e) {}
          try {
            localDB.saveData(KEYS.WASTE, serverListings);
          } catch (e) {}

          return { listings: serverListings, isOffline: false };
        }
      } else {
        isOffline = true;
      }
    } catch (err) {
      console.warn('[MarketplaceService] Backend fetch failed, falling back to local cache:', err.message);
      isOffline = true;
    }

    // Fallback to IndexedDB / localDB cache
    let cached = [];
    try {
      cached = await db.getAll(STORES.MARKETPLACE_LISTINGS);
    } catch (e) {}

    if (!cached || cached.length === 0) {
      cached = localDB.getData(KEYS.WASTE) || [];
    }

    const normalizedCached = (cached || []).map(normalizeListing);
    return { listings: normalizedCached, isOffline: true };
  }

  /**
   * Post new produce / crop waste listing to backend + shared DB
   */
  async createListing(data, currentUser) {
    const userId = currentUser?.userId || currentUser?.id;
    const userName = currentUser?.name || currentUser?.full_name || 'Agro Farmer';
    const userPhone = currentUser?.phone || null;

    const payload = {
      id: data.id || `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      creator_id: userId,
      creator_role: data.creatorRole || (currentUser?.activeRole === 'buyer' ? 'buyer' : 'farmer'),
      crop_type: data.crop_type || data.crop,
      quantity_kg: Number(data.quantity_kg || data.quantity),
      condition: data.condition || 'damaged',
      asking_price: Number(data.asking_price || data.price || 0),
      status: data.status || 'listed',
      location: data.location || 'Local Farm',
      farmer_name: userName,
      contact_phone: userPhone,
      image_url: data.image || data.image_url || null,
      source_assessment_id: data.sourceAssessmentId || data.source_assessment_id || null,
      title: data.title || `${data.crop_type || data.crop} Crop Waste`
    };

    try {
      const response = await fetch(`${API_BASE_URL}/marketplace/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const json = await response.json();
        const saved = normalizeListing(json.data || payload);
        saved.sync_status = 'synced';

        // Cache in local storage
        try {
          await db.put(STORES.MARKETPLACE_LISTINGS, saved);
          localDB.addItem(KEYS.WASTE, saved);
        } catch (e) {}

        return { success: true, data: saved, isOffline: false };
      } else {
        const errJson = await response.json().catch(() => ({ message: 'Server error' }));
        throw new Error(errJson.message || `Server returned ${response.status}`);
      }
    } catch (err) {
      console.warn('[MarketplaceService] Server unavailable during post. Saving local draft:', err.message);

      // Save local draft / pending sync
      const localDraft = normalizeListing({ ...payload, sync_status: 'pending' });
      try {
        await db.put(STORES.MARKETPLACE_LISTINGS, localDraft);
        localDB.addItem(KEYS.WASTE, localDraft);
        enqueueAction({
          userId,
          actionType: ACTION_TYPES.CREATE_MARKETPLACE_LISTING,
          entityType: 'marketplaceListing',
          entityId: localDraft.id,
          payload: localDraft
        });
      } catch (e) {}

      return {
        success: false,
        isOffline: true,
        error: 'Unable to publish listing because the server is unavailable. Saved as a local pending draft.',
        data: localDraft
      };
    }
  }

  /**
   * Update an existing listing with ownership authorization check
   */
  async updateListing(id, updates, currentUser) {
    const userId = currentUser?.userId || currentUser?.id;

    try {
      const response = await fetch(`${API_BASE_URL}/marketplace/listings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const json = await response.json();
        const updated = normalizeListing(json.data);

        try {
          await db.put(STORES.MARKETPLACE_LISTINGS, updated);
          localDB.updateItem(KEYS.WASTE, id, updated);
        } catch (e) {}

        return { success: true, data: updated };
      } else if (response.status === 403) {
        return { success: false, error: 'You are not authorized to edit this listing' };
      } else {
        const errJson = await response.json().catch(() => ({ message: 'Server error' }));
        throw new Error(errJson.message || `Server returned ${response.status}`);
      }
    } catch (err) {
      console.warn('[MarketplaceService] Update failed on backend:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete / Deactivate listing with ownership authorization check
   */
  async deleteListing(id, currentUser) {
    const userId = currentUser?.userId || currentUser?.id;

    try {
      const response = await fetch(`${API_BASE_URL}/marketplace/listings/${id}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': userId
        }
      });

      if (response.ok) {
        try {
          await db.remove(STORES.MARKETPLACE_LISTINGS, id);
          localDB.deleteItem(KEYS.WASTE, id);
        } catch (e) {}

        return { success: true };
      } else if (response.status === 403) {
        return { success: false, error: 'You are not authorized to remove this listing' };
      } else {
        const errJson = await response.json().catch(() => ({ message: 'Server error' }));
        throw new Error(errJson.message || `Server returned ${response.status}`);
      }
    } catch (err) {
      console.warn('[MarketplaceService] Delete failed on backend:', err.message);
      return { success: false, error: err.message };
    }
  }
}

export const marketplaceService = new MarketplaceService();
