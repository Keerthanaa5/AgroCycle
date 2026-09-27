/**
 * AgroCycle Central Location & GPS Service
 *
 * Core reusable infrastructure service for capturing, persisting, and retrieving
 * user/farm geolocation coordinates offline and across all AgroCycle modules.
 *
 * CORE PRINCIPLES & CONSTRAINTS:
 * 1. Uses native browser navigator.geolocation.getCurrentPosition (explicit one-time request).
 * 2. Does NOT perform continuous tracking (no watchPosition polling).
 * 3. Does NOT send coordinates to external APIs, maps, weather, or LLMs.
 * 4. Offline-first: Coordinates persist locally in IndexedDB (STORES.USER_LOCATIONS)
 *    and can be retrieved without any network connectivity.
 * 5. Uses canonical user identity: user.userId with fallback to user.id.
 * 6. Supports future multi-farm scaling via farmId parameter (defaults to "default").
 */

import * as db from "./indexedDB.js";
import { STORES } from "./indexedDB.js";
import { enqueueAction, ACTION_TYPES } from "./syncQueue.js";
import { syncManager } from "./syncManager.js";


/**
 * Location State Constants
 */
export const LOCATION_STATUS = {
  NOT_SET: "not_set",
  REQUESTING: "requesting",
  AVAILABLE: "available",
  DENIED: "denied",
  UNAVAILABLE: "unavailable",
  TIMEOUT: "timeout",
  UNSUPPORTED: "unsupported",
  ERROR: "error"
};

/**
 * Location Source Constants
 */
export const LOCATION_SOURCE = {
  DEVICE_GPS: "device-gps",
  MANUAL_ENTRY: "manual-entry",
  CACHED: "cached"
};

// In-memory status & cache
let currentStatus = LOCATION_STATUS.NOT_SET;
const memoryCache = new Map();

/**
 * Extracts the canonical user ID according to AgroCycle identity conventions.
 * Prioritizes user.userId with fallback to user.id or active session.
 *
 * @param {string|object|null} userOrId
 * @returns {string} canonical user ID
 */
export function getCanonicalUserId(userOrId) {
  if (!userOrId) {
    try {
      if (typeof localStorage !== "undefined") {
        const rawUser = localStorage.getItem("user");
        if (rawUser) {
          const u = JSON.parse(rawUser);
          return u?.userId || u?.id || "default_user";
        }
      }
    } catch (e) {}
    return "default_user";
  }

  if (typeof userOrId === "object") {
    return userOrId.userId || userOrId.id || "default_user";
  }

  return String(userOrId).trim() || "default_user";
}

/**
 * Generates standard deterministic storage key for location records.
 *
 * @param {string} userId
 * @param {string} farmId
 * @returns {string} record primary key
 */
export function getLocationRecordId(userId, farmId = "default") {
  const canonicalUser = getCanonicalUserId(userId);
  const cleanFarm = String(farmId || "default").trim();
  return `loc_${canonicalUser}_${cleanFarm}`;
}

/**
 * Checks if Geolocation API is supported in the current environment.
 *
 * @returns {boolean}
 */
export function isGeolocationAvailable() {
  return (
    typeof navigator !== "undefined" &&
    "geolocation" in navigator &&
    typeof navigator.geolocation?.getCurrentPosition === "function"
  );
}

/**
 * Returns current in-memory location status.
 *
 * @returns {string}
 */
export function getLocationStatus() {
  return currentStatus;
}

/**
 * Formats coordinates for clean UI presentation.
 *
 * @param {number} coord
 * @param {number} decimals
 * @returns {string}
 */
export function formatCoordinate(coord, decimals = 6) {
  if (coord === null || coord === undefined || isNaN(Number(coord))) {
    return "—";
  }
  return Number(coord).toFixed(decimals);
}

/**
 * Explicit one-time browser Geolocation request.
 * Does not start continuous tracking.
 *
 * @param {PositionOptions} [options]
 * @returns {Promise<{success: boolean, status: string, location?: object, error?: string, errorCode?: number}>}
 */
export async function requestLocation(options = {}) {
  if (!isGeolocationAvailable()) {
    currentStatus = LOCATION_STATUS.UNSUPPORTED;
    return {
      success: false,
      status: LOCATION_STATUS.UNSUPPORTED,
      error: "Geolocation is not supported by this browser or device.",
      errorCode: -1
    };
  }

  currentStatus = LOCATION_STATUS.REQUESTING;

  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000,
    ...options
  };

  return new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          currentStatus = LOCATION_STATUS.AVAILABLE;

          const locationData = {
            latitude: Number(position.coords.latitude),
            longitude: Number(position.coords.longitude),
            accuracy: Number(position.coords.accuracy || 0),
            timestamp: position.timestamp || Date.now(),
            source: LOCATION_SOURCE.DEVICE_GPS
          };

          resolve({
            success: true,
            status: LOCATION_STATUS.AVAILABLE,
            location: locationData
          });
        },
        (error) => {
          let status = LOCATION_STATUS.ERROR;
          let userMessage = "Unable to retrieve location.";

          // Standard GeolocationPositionError codes:
          // 1: PERMISSION_DENIED
          // 2: POSITION_UNAVAILABLE
          // 3: TIMEOUT
          if (error.code === 1) {
            status = LOCATION_STATUS.DENIED;
            userMessage =
              "Location permission was denied. You can enable it later or enter your location manually when a location-based feature requires it.";
          } else if (error.code === 2) {
            status = LOCATION_STATUS.UNAVAILABLE;
            userMessage =
              "GPS signal is unavailable. Please check your device location settings and try again.";
          } else if (error.code === 3) {
            status = LOCATION_STATUS.TIMEOUT;
            userMessage = "Location request timed out. Please try again.";
          }

          currentStatus = status;

          resolve({
            success: false,
            status,
            error: userMessage,
            errorCode: error.code,
            rawMessage: error.message
          });
        },
        geoOptions
      );
    } catch (err) {
      currentStatus = LOCATION_STATUS.ERROR;
      resolve({
        success: false,
        status: LOCATION_STATUS.ERROR,
        error: err.message || "An unexpected error occurred while requesting location.",
        errorCode: -2
      });
    }
  });
}

/**
 * Reverse-geocodes latitude and longitude coordinates into City, District, State, and Country.
 * Fully resilient & offline-tolerant:
 * 1. Executes with a configurable timeout (default 3.5s) using AbortController.
 * 2. Catches all network errors, offline conditions, and parse failures.
 * 3. Never throws - returns null fields gracefully if geocoding is unavailable.
 * 4. Never blocks, fails, or interrupts GPS capture.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {object} [options]
 * @returns {Promise<{city: string|null, district: string|null, state: string|null, country: string|null}>}
 */
export async function reverseGeocode(latitude, longitude, options = {}) {
  const result = {
    city: null,
    district: null,
    state: null,
    country: null
  };

  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    isNaN(Number(latitude)) ||
    isNaN(Number(longitude))
  ) {
    return result;
  }

  const lat = Number(latitude);
  const lon = Number(longitude);
  const timeoutMs = options.timeoutMs || 3500;

  try {
    if (typeof fetch === "undefined") {
      return result;
    }

    // Attempt 1: OpenStreetMap Nominatim client reverse geocoder
    const controller1 = new AbortController();
    const timer1 = setTimeout(() => controller1.abort(), timeoutMs);

    try {
      const url1 = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;
      const res1 = await fetch(url1, {
        signal: controller1.signal,
        headers: { Accept: "application/json" }
      });
      clearTimeout(timer1);

      if (res1.ok) {
        const data1 = await res1.json();
        const addr = data1?.address || {};

        result.city =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.suburb ||
          addr.hamlet ||
          addr.city_district ||
          null;

        result.district =
          addr.state_district ||
          addr.district ||
          addr.county ||
          null;

        result.state =
          addr.state ||
          addr.province ||
          addr.region ||
          null;

        result.country =
          addr.country ||
          null;

        if (result.city || result.state || result.country) {
          return result;
        }
      }
    } catch (e1) {
      clearTimeout(timer1);
    }

    // Attempt 2: BigDataCloud free client reverse geocoder fallback
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), timeoutMs);

    try {
      const url2 = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
      const res2 = await fetch(url2, { signal: controller2.signal });
      clearTimeout(timer2);

      if (res2.ok) {
        const data2 = await res2.json();
        result.city = result.city || data2.city || data2.locality || null;
        result.district = result.district || data2.principalSubdivisionDistrict || null;
        result.state = result.state || data2.principalSubdivision || null;
        result.country = result.country || data2.countryName || null;
      }
    } catch (e2) {
      clearTimeout(timer2);
    }
  } catch (err) {
    // Reverse geocoding failure MUST NOT fail GPS capture
  }

  return result;
}

/**
 * Persists location locally in IndexedDB and local memory/localStorage fallback.
 *
 * @param {object} locationData - { latitude, longitude, accuracy, timestamp, source, city, district, state, country, capturedAt }
 * @param {string|object} [userId] - Canonical user ID or user object
 * @param {string} [farmId="default"] - Multi-farm identifier
 * @param {string} [farmName="Main Farm"] - Optional farm label
 * @returns {Promise<object>} Saved location record
 */
export async function saveLocation(
  locationData,
  userId = null,
  farmId = "default",
  farmName = "Main Farm"
) {
  if (!locationData || typeof locationData.latitude !== "number" || typeof locationData.longitude !== "number") {
    throw new Error("Invalid location data: latitude and longitude must be valid numbers.");
  }

  const canonicalUserId = getCanonicalUserId(userId);
  const recordId = getLocationRecordId(canonicalUserId, farmId);

  const record = {
    id: recordId,
    userId: canonicalUserId,
    farmId: farmId || "default",
    farmName: farmName || "Main Farm",
    latitude: Number(locationData.latitude),
    longitude: Number(locationData.longitude),
    accuracy: Number(locationData.accuracy || 0),
    timestamp: Number(locationData.timestamp || Date.now()),
    source: locationData.source || LOCATION_SOURCE.DEVICE_GPS,
    city: locationData.city || null,
    district: locationData.district || null,
    state: locationData.state || null,
    country: locationData.country || null,
    capturedAt: locationData.capturedAt || locationData.timestamp || Date.now(),
    isDefault: farmId === "default",
    createdAt: locationData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // 1. Update In-Memory Cache
  memoryCache.set(recordId, record);
  currentStatus = LOCATION_STATUS.AVAILABLE;

  // 2. Persist to LocalStorage Fallback
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`agrocycle_location_${recordId}`, JSON.stringify(record));
    }
  } catch (e) {}

  // 3. Persist to Canonical IndexedDB Store (STORES.USER_LOCATIONS)
  try {
    await db.put(STORES.USER_LOCATIONS, record);
  } catch (idbErr) {
    // Graceful fallback to SYSTEM_META if store upgrade is pending
    try {
      await db.put(STORES.SYSTEM_META, {
        key: `location_${recordId}`,
        ...record
      });
    } catch (metaErr) {
      console.warn("[LocationService] IndexedDB persistence warning:", metaErr);
    }
  }

  // 4. Enqueue for offline sync
  try {
    enqueueAction({
      userId: canonicalUserId,
      actionType: ACTION_TYPES.SAVE_LOCATION,
      entityType: "userLocations",
      entityId: recordId,
      payload: record
    }).then(() => {
      if (syncManager.isOnline()) {
        syncManager.processQueue(canonicalUserId).catch(() => {});
      }
    }).catch(err => console.warn("[LocationService] Enqueue sync error:", err));
  } catch (syncErr) {
    console.warn("[LocationService] Sync enqueue warning:", syncErr);
  }

  return record;
}

/**
 * Retrieves the saved location from IndexedDB with memory and localStorage fallbacks.
 * Works 100% offline with zero network requests.
 *
 * @param {string|object} [userId]
 * @param {string} [farmId="default"]
 * @returns {Promise<object|null>}
 */
export async function getSavedLocation(userId = null, farmId = "default") {
  const canonicalUserId = getCanonicalUserId(userId);
  const recordId = getLocationRecordId(canonicalUserId, farmId);

  // 1. Check in-memory cache
  if (memoryCache.has(recordId)) {
    return memoryCache.get(recordId);
  }

  // 2. Try IndexedDB STORES.USER_LOCATIONS
  try {
    const fromDB = await db.get(STORES.USER_LOCATIONS, recordId);
    if (fromDB && typeof fromDB.latitude === "number" && typeof fromDB.longitude === "number") {
      memoryCache.set(recordId, fromDB);
      currentStatus = LOCATION_STATUS.AVAILABLE;
      return fromDB;
    }
  } catch (e) {
    // If store is not yet open or available, try SYSTEM_META
    try {
      const fromMeta = await db.get(STORES.SYSTEM_META, `location_${recordId}`);
      if (fromMeta && typeof fromMeta.latitude === "number") {
        memoryCache.set(recordId, fromMeta);
        currentStatus = LOCATION_STATUS.AVAILABLE;
        return fromMeta;
      }
    } catch (metaErr) {}
  }

  // 3. Fallback to localStorage
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(`agrocycle_location_${recordId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.latitude === "number") {
          memoryCache.set(recordId, parsed);
          currentStatus = LOCATION_STATUS.AVAILABLE;
          return parsed;
        }
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Updates the saved location for a given user and farm.
 *
 * @param {object} locationData
 * @param {string|object} [userId]
 * @param {string} [farmId="default"]
 * @returns {Promise<object>}
 */
export async function updateLocation(locationData, userId = null, farmId = "default") {
  return saveLocation(locationData, userId, farmId);
}

/**
 * Clears/removes the saved location from IndexedDB, cache, and localStorage.
 *
 * @param {string|object} [userId]
 * @param {string} [farmId="default"]
 * @returns {Promise<boolean>}
 */
export async function clearLocation(userId = null, farmId = "default") {
  const canonicalUserId = getCanonicalUserId(userId);
  const recordId = getLocationRecordId(canonicalUserId, farmId);

  // 1. Remove from in-memory cache
  memoryCache.delete(recordId);
  currentStatus = LOCATION_STATUS.NOT_SET;

  // 2. Remove from localStorage
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(`agrocycle_location_${recordId}`);
    }
  } catch (e) {}

  // 3. Remove from IndexedDB
  try {
    await db.remove(STORES.USER_LOCATIONS, recordId);
  } catch (e) {
    try {
      await db.remove(STORES.SYSTEM_META, `location_${recordId}`);
    } catch (metaErr) {}
  }

  return true;
}

/**
 * Checks if a saved location exists for the given user and farm.
 *
 * @param {string|object} [userId]
 * @param {string} [farmId="default"]
 * @returns {Promise<boolean>}
 */
export async function hasLocation(userId = null, farmId = "default") {
  const loc = await getSavedLocation(userId, farmId);
  return Boolean(loc && typeof loc.latitude === "number" && typeof loc.longitude === "number");
}

/**
 * Convenience helper: Requests current GPS position from browser and immediately persists it.
 *
 * @param {string|object} [userId]
 * @param {string} [farmId="default"]
 * @param {PositionOptions} [options]
 * @returns {Promise<{success: boolean, status: string, location?: object, error?: string}>}
 */
export async function captureAndSaveCurrentLocation(
  userId = null,
  farmId = "default",
  options = {}
) {
  const result = await requestLocation(options);
  if (result.success && result.location) {
    let geoDetails = {
      city: null,
      district: null,
      state: null,
      country: null
    };

    try {
      geoDetails = await reverseGeocode(
        result.location.latitude,
        result.location.longitude,
        { timeoutMs: options.timeoutMs || 3500 }
      );
    } catch (geoErr) {
      // Graceful fallback - reverse geocoding failure MUST NOT fail GPS capture
      console.warn("[LocationService] Reverse geocoding warning:", geoErr);
    }

    const fullLocationData = {
      ...result.location,
      city: geoDetails.city || result.location.city || null,
      district: geoDetails.district || result.location.district || null,
      state: geoDetails.state || result.location.state || null,
      country: geoDetails.country || result.location.country || null,
      capturedAt: result.location.timestamp || Date.now()
    };

    const saved = await saveLocation(fullLocationData, userId, farmId);
    return {
      success: true,
      status: LOCATION_STATUS.AVAILABLE,
      location: saved
    };
  }

  return result;
}

/**
 * Multi-farm extension helper: List all saved farms/locations for a canonical user.
 *
 * @param {string|object} [userId]
 * @returns {Promise<Array<object>>}
 */
export async function listUserFarmLocations(userId = null) {
  const canonicalUserId = getCanonicalUserId(userId);
  try {
    const all = await db.getByIndex(STORES.USER_LOCATIONS, "userId", canonicalUserId);
    if (all && all.length > 0) return all;
  } catch (e) {}

  // Fallback: check default saved location
  const defaultLoc = await getSavedLocation(canonicalUserId, "default");
  return defaultLoc ? [defaultLoc] : [];
}
