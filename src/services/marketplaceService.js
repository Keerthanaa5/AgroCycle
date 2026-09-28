/**
 * AgroCycle Marketplace Service
 *
 * Provides shared backend synchronization with PostgreSQL as the persistent source of truth,
 * with IndexedDB / localDB as an offline cache and draft layer.
 */

import { localDB, KEYS } from './localDB.js';
import * as db from './indexedDB.js';
import { STORES } from './indexedDB.js';
import { enqueueAction, ACTION_TYPES } from './syncQueue.js';

export function getApiBaseUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return 'http://localhost:5000/api/v1';
}

const API_BASE_URL = getApiBaseUrl();

/**
 * Standardizes backend database record into consistent frontend marketplace model
 */
export function normalizeListing(raw) {
  if (!raw) return null;
  const isBuyerListing = raw.creator_role === 'buyer' || raw.creatorRole === 'buyer' || raw.listingType === 'buy' || Boolean(raw.buyerPhone);

  const rawLat = (raw.latitude !== undefined && raw.latitude !== null && raw.latitude !== "") ? Number(raw.latitude) : null;
  const rawLon = (raw.longitude !== undefined && raw.longitude !== null && raw.longitude !== "") ? Number(raw.longitude) : null;
  const lat = (rawLat !== null && !isNaN(rawLat) && Number.isFinite(rawLat)) ? rawLat : null;
  const lon = (rawLon !== null && !isNaN(rawLon) && Number.isFinite(rawLon)) ? rawLon : null;

  const listingId = String(raw.id || raw.listingId || `wp_${Date.now()}`);
  const farmerName = !isBuyerListing ? (raw.farmer_name || raw.farmerName || raw.creatorName || raw.creator_name || raw.user || 'Local Farmer') : null;

  return {
    id: listingId,
    listingId: listingId,
    creatorId: raw.creator_id || raw.creatorId || null,
    creatorRole: raw.creator_role || raw.creatorRole || (isBuyerListing ? 'buyer' : 'farmer'),
    creatorName: raw.farmer_name || raw.farmerName || raw.creator_name || raw.creatorName || raw.user || 'User',
    creatorPhone: raw.contact_phone || raw.contactPhone || raw.phone || raw.creatorPhone,
    creatorVerificationStatus: raw.creatorVerificationStatus || raw.verification_status || 'verified',

    listingType: isBuyerListing ? 'buy' : 'sell',
    buyerId: isBuyerListing ? (raw.creator_id || raw.buyerId) : null,
    buyerName: isBuyerListing ? (raw.farmer_name || raw.buyerName || raw.creatorName) : null,
    buyerPhone: isBuyerListing ? (raw.contact_phone || raw.buyerPhone || raw.phone) : null,

    farmerName: farmerName,
    farmer_name: farmerName,
    farmerPhone: !isBuyerListing ? (raw.contact_phone || raw.farmerPhone || raw.phone) : null,

    title: raw.title || `${raw.crop_type || raw.crop || 'Crop'} Fresh Produce`,
    crop: raw.crop_type || raw.crop,
    crop_type: raw.crop_type || raw.crop,
    quantity_kg: Number(raw.quantity_kg !== undefined ? raw.quantity_kg : (raw.quantity !== undefined ? raw.quantity : (raw.availableQuantityKg !== undefined ? raw.availableQuantityKg : 0))),
    condition: raw.condition || 'fresh',
    location: raw.location || 'Local Farm',
    latitude: lat,
    longitude: lon,
    district: raw.district || null,
    state: raw.state || null,

    asking_price: Number(raw.asking_price !== undefined ? raw.asking_price : (raw.price !== undefined ? raw.price : 0)),
    status: raw.status || 'listed',
    images: (() => {
      let imgs = [];
      if (Array.isArray(raw.images)) {
        imgs = raw.images.filter(Boolean);
      } else if (typeof raw.images === 'string') {
        try {
          const p = JSON.parse(raw.images);
          if (Array.isArray(p)) imgs = p.filter(Boolean);
          else if (p) imgs = [p];
        } catch {
          imgs = [raw.images];
        }
      }
      if (imgs.length === 0) {
        const rawImg = raw.image_url || raw.image;
        if (rawImg && typeof rawImg === 'string') {
          if (rawImg.trim().startsWith('[') || rawImg.trim().startsWith('{')) {
            try {
              const p = JSON.parse(rawImg);
              if (Array.isArray(p)) imgs = p.filter(Boolean);
              else if (p) imgs = [p];
            } catch {
              imgs = [rawImg];
            }
          } else {
            imgs = [rawImg];
          }
        }
      }
      return imgs.slice(0, 3);
    })(),
    image: (() => {
      if (Array.isArray(raw.images) && raw.images.length > 0) return raw.images[0];
      if (raw.image_url && typeof raw.image_url === 'string' && raw.image_url.startsWith('[')) {
        try { const p = JSON.parse(raw.image_url); if (Array.isArray(p) && p.length > 0) return p[0]; } catch {}
      }
      return raw.image_url || raw.image || null;
    })(),
    image_url: (() => {
      if (Array.isArray(raw.images) && raw.images.length > 0) return raw.images[0];
      if (raw.image_url && typeof raw.image_url === 'string' && raw.image_url.startsWith('[')) {
        try { const p = JSON.parse(raw.image_url); if (Array.isArray(p) && p.length > 0) return p[0]; } catch {}
      }
      return raw.image_url || raw.image || null;
    })(),
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
   * Distinguishes between network failure (offline) and HTTP error responses (400, 403, 500, etc.)
   */
  async createListing(data, currentUser) {
    const userId = data.creator_id || data.creatorId || currentUser?.userId || currentUser?.id || 'usr_farmer_ramesh_01';
    const userName = data.farmer_name || data.farmerName || data.creatorName || data.creator_name || currentUser?.name || currentUser?.full_name || 'Agro Farmer';
    const userPhone = data.contact_phone || data.contactPhone || data.farmerPhone || data.phone || currentUser?.phone || null;

    const rawQty = data.quantity_kg !== undefined ? data.quantity_kg : data.quantity;
    const quantityKg = Number(rawQty);
    const rawPrice = data.asking_price !== undefined ? data.asking_price : data.price;
    const askingPrice = Number(rawPrice) >= 0 ? Number(rawPrice) : 0;

    const payload = {
      id: data.id || `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      creator_id: userId,
      creator_role: data.creator_role || data.creatorRole || (currentUser?.activeRole === 'buyer' ? 'buyer' : 'farmer'),
      crop_type: data.crop_type || data.crop || 'Crop',
      quantity_kg: quantityKg,
      condition: data.condition || 'fresh',
      asking_price: askingPrice,
      status: data.status || 'listed',
      location: data.location || 'Local Farm',
      latitude: data.latitude !== undefined && data.latitude !== null ? Number(data.latitude) : null,
      longitude: data.longitude !== undefined && data.longitude !== null ? Number(data.longitude) : null,
      district: data.district || null,
      state: data.state || null,
      farmer_name: userName,
      contact_phone: userPhone,
      images: Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 3) : (data.images ? [data.images] : (data.image || data.image_url ? [data.image || data.image_url] : [])),
      image_url: Array.isArray(data.images) && data.images.length > 0 ? JSON.stringify(data.images.slice(0, 3)) : (data.image || data.image_url || null),
      source_assessment_id: data.sourceAssessmentId || data.source_assessment_id || null,
      title: data.title || `${data.crop_type || data.crop || 'Crop'} Fresh Produce`
    };

    const apiBase = getApiBaseUrl();
    const targetUrl = `${apiBase}/marketplace/listings`;
    const headers = {
      'Content-Type': 'application/json'
    };

    console.log('[MarketplaceService createListing Diagnostic: Outgoing Request]', {
      apiBase,
      targetUrl,
      userId,
      headers,
      sourceAssessmentId: payload.source_assessment_id,
      source: data.source || 'manual',
      crop_type: payload.crop_type,
      quantity_kg: payload.quantity_kg,
      condition: payload.condition,
      location: payload.location,
      asking_price: payload.asking_price,
      imagePresent: Boolean(payload.image_url),
      imageLength: payload.image_url ? payload.image_url.length : 0,
      fetchInitiatedAt: new Date().toISOString()
    });

    let response = null;
    let responseText = null;

    try {
      console.log('[MarketplaceService createListing] fetch() starting to:', targetUrl);
      response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      console.log('[MarketplaceService createListing] fetch() resolved:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
    } catch (networkErr) {
      // 1. Genuine Network / Fetch / Connection Failure
      console.error('[MarketplaceService createListing Diagnostic: Network Error Caught]', {
        apiBase,
        targetUrl,
        userId,
        headers,
        payload,
        errorName: networkErr?.name,
        errorMessage: networkErr?.message,
        errorStack: networkErr?.stack
      });

      // Save local draft / pending sync for offline recovery
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
        error: `Unable to connect to server (${networkErr.message}). Saved as a local pending draft.`,
        data: localDraft
      };
    }

    console.log('[MarketplaceService createListing Diagnostic: Response Status]', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    // 2. HTTP Response Handled from Server
    if (response.ok) {
      try {
        const json = await response.json();
        const saved = normalizeListing(json.data || payload);
        saved.sync_status = 'synced';

        console.log('[MarketplaceService createListing Diagnostic: Success]', saved);

        // Cache in local storage
        try {
          await db.put(STORES.MARKETPLACE_LISTINGS, saved);
          localDB.addItem(KEYS.WASTE, saved);
        } catch (e) {}

        return { success: true, data: saved, isOffline: false };
      } catch (parseErr) {
        console.warn('[MarketplaceService createListing] JSON parsing fallback:', parseErr);
        const fallbackSaved = normalizeListing(payload);
        return { success: true, data: fallbackSaved, isOffline: false };
      }
    } else {
      // 3. HTTP Server-Side Error (400, 401, 403, 422, 500)
      let errMessage = `Server returned HTTP ${response.status}`;
      let errData = null;
      try {
        responseText = await response.text();
        errData = JSON.parse(responseText);
        errMessage = errData.message || errData.error || errMessage;
      } catch (e) {
        if (responseText) errMessage = responseText;
      }

      console.error('[MarketplaceService createListing Diagnostic: HTTP Server Error]', {
        API_BASE_URL,
        userId,
        status: response.status,
        statusText: response.statusText,
        error: errMessage,
        responseBody: errData || responseText,
        targetUrl,
        payload
      });

      return {
        success: false,
        isOffline: false,
        status: response.status,
        error: `Server error (${response.status}): ${errMessage}`,
        data: null
      };
    }
  }

  /**
   * Update an existing listing with ownership authorization check
   */
  async updateListing(id, updates, currentUser) {
    const userId = currentUser?.userId || currentUser?.id;
    const targetUrl = `${API_BASE_URL}/marketplace/listings/${id}`;

    try {
      const response = await fetch(targetUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...updates, creator_id: userId, userId })
      });

      if (response.ok) {
        const json = await response.json();
        const updated = normalizeListing(json.data);

        try {
          await db.put(STORES.MARKETPLACE_LISTINGS, updated);
          localDB.updateItem(KEYS.WASTE, id, updated);
        } catch (e) {}

        return { success: true, data: updated };
      } else {
        const errJson = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        console.error('[MarketplaceService updateListing HTTP Error]', { status: response.status, error: errJson });
        return { success: false, error: errJson.message || `Unable to update listing (HTTP ${response.status})` };
      }
    } catch (err) {
      console.error('[MarketplaceService updateListing Network Error]', { error: err, apiUrl: targetUrl, userId });
      return { success: false, error: `Network error: ${err.message}` };
    }
  }

  /**
   * Delete / Deactivate listing with ownership authorization check
   */
  async deleteListing(id, currentUser) {
    const userId = currentUser?.userId || currentUser?.id;
    const targetUrl = `${API_BASE_URL}/marketplace/listings/${id}?userId=${encodeURIComponent(userId || '')}`;

    try {
      const response = await fetch(targetUrl, {
        method: 'DELETE'
      });

      if (response.ok) {
        try {
          await db.remove(STORES.MARKETPLACE_LISTINGS, id);
          localDB.deleteItem(KEYS.WASTE, id);
        } catch (e) {}

        return { success: true };
      } else {
        const errJson = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        console.error('[MarketplaceService deleteListing HTTP Error]', { status: response.status, error: errJson });
        return { success: false, error: errJson.message || `Unable to delete listing (HTTP ${response.status})` };
      }
    } catch (err) {
      console.error('[MarketplaceService deleteListing Network Error]', { error: err, apiUrl: targetUrl, userId });
      return { success: false, error: `Network error: ${err.message}` };
    }
  }
}

export const marketplaceService = new MarketplaceService();
