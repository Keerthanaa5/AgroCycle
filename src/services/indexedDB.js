/**
 * AgroCycle Central IndexedDB Database Service (AgroCycleDB)
 * 
 * Provides a lightweight, promisified IndexedDB wrapper for offline-first
 * storage across all AgroCycle modules.
 */

export const DB_NAME = "AgroCycleDB";
export const DB_VERSION = 3;

export const STORES = {
  USERS: "users",
  SESSIONS: "sessions",
  MARKETPLACE_LISTINGS: "marketplaceListings",
  SILAGE_CENTERS: "silageCenters",
  SILAGE_BOOKINGS: "silageBookings",
  AGRO_CONNECT: "agroConnectActivities",
  CARBON_ACTIVITIES: "carbonActivities",
  CARBON_OFFERS: "carbonOffers",
  CLAIM_DOSSIERS: "claimDossiers",
  SCAN_HISTORY: "scanHistory",
  NOTIFICATIONS: "notifications",
  SYSTEM_META: "systemMeta",
  SYNC_QUEUE: "syncQueue",
  USER_LOCATIONS: "userLocations"
};

const STORE_CONFIGS = {
  [STORES.USER_LOCATIONS]: {
    keyPath: "id",
    indexes: [
      { name: "userId", keyPath: "userId", unique: false },
      { name: "farmId", keyPath: "farmId", unique: false },
      { name: "isDefault", keyPath: "isDefault", unique: false },
      { name: "timestamp", keyPath: "timestamp", unique: false }
    ]
  },
  [STORES.SYNC_QUEUE]: {
    keyPath: "id",
    indexes: [
      { name: "userId", keyPath: "userId", unique: false },
      { name: "status", keyPath: "status", unique: false },
      { name: "actionType", keyPath: "actionType", unique: false },
      { name: "idempotencyKey", keyPath: "idempotencyKey", unique: true },
      { name: "createdAt", keyPath: "createdAt", unique: false }
    ]
  },
  [STORES.USERS]: {
    keyPath: "userId",
    indexes: [
      { name: "phone", keyPath: "phone", unique: false },
      { name: "activeRole", keyPath: "activeRole", unique: false },
      { name: "verificationStatus", keyPath: "verificationStatus", unique: false }
    ]
  },
  [STORES.SESSIONS]: {
    keyPath: "id",
    indexes: [
      { name: "userId", keyPath: "userId", unique: false },
      { name: "activeRole", keyPath: "activeRole", unique: false }
    ]
  },
  [STORES.MARKETPLACE_LISTINGS]: {
    keyPath: "id",
    indexes: [
      { name: "creatorId", keyPath: "creatorId", unique: false },
      { name: "creatorRole", keyPath: "creatorRole", unique: false },
      { name: "crop_type", keyPath: "crop_type", unique: false },
      { name: "status", keyPath: "status", unique: false }
    ]
  },
  [STORES.SILAGE_CENTERS]: {
    keyPath: "id",
    indexes: [
      { name: "creatorId", keyPath: "creatorId", unique: false },
      { name: "creatorRole", keyPath: "creatorRole", unique: false },
      { name: "location", keyPath: "location", unique: false },
      { name: "status", keyPath: "status", unique: false }
    ]
  },
  [STORES.SILAGE_BOOKINGS]: {
    keyPath: "id",
    indexes: [
      { name: "creatorId", keyPath: "creatorId", unique: false },
      { name: "centerId", keyPath: "centerId", unique: false },
      { name: "status", keyPath: "status", unique: false },
      { name: "created_at", keyPath: "created_at", unique: false }
    ]
  },
  [STORES.AGRO_CONNECT]: {
    keyPath: "id",
    indexes: [
      { name: "creatorId", keyPath: "creatorId", unique: false },
      { name: "creatorRole", keyPath: "creatorRole", unique: false },
      { name: "crop_type", keyPath: "crop_type", unique: false },
      { name: "post_type", keyPath: "post_type", unique: false }
    ]
  },
  [STORES.CARBON_ACTIVITIES]: {
    keyPath: "id",
    indexes: [
      { name: "creatorId", keyPath: "creatorId", unique: false },
      { name: "creatorRole", keyPath: "creatorRole", unique: false },
      { name: "status", keyPath: "status", unique: false },
      { name: "sponsorId", keyPath: "sponsorId", unique: false }
    ]
  },
  [STORES.CARBON_OFFERS]: {
    keyPath: "id",
    indexes: [
      { name: "activityId", keyPath: "activityId", unique: false },
      { name: "sponsorId", keyPath: "sponsorId", unique: false },
      { name: "status", keyPath: "status", unique: false }
    ]
  },
  [STORES.CLAIM_DOSSIERS]: {
    keyPath: "id",
    indexes: [
      { name: "creatorId", keyPath: "creatorId", unique: false },
      { name: "farmer_id", keyPath: "farmer_id", unique: false },
      { name: "crop_type", keyPath: "crop_type", unique: false },
      { name: "status", keyPath: "status", unique: false }
    ]
  },
  [STORES.SCAN_HISTORY]: {
    keyPath: "id",
    indexes: [
      { name: "creatorId", keyPath: "creatorId", unique: false },
      { name: "cropName", keyPath: "cropName", unique: false },
      { name: "condition", keyPath: "condition", unique: false },
      { name: "date", keyPath: "date", unique: false }
    ]
  },
  [STORES.NOTIFICATIONS]: {
    keyPath: "id",
    indexes: [
      { name: "userId", keyPath: "userId", unique: false },
      { name: "is_read", keyPath: "is_read", unique: false },
      { name: "created_date", keyPath: "created_date", unique: false }
    ]
  },
  [STORES.SYSTEM_META]: {
    keyPath: "key"
  }
};

let dbInstance = null;
let dbPromise = null;

/**
 * Get the IndexedDB implementation (browser window or global context)
 */
function getIDBFactory() {
  if (typeof window !== "undefined" && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== "undefined" && globalThis.indexedDB) {
    return globalThis.indexedDB;
  }
  return null;
}

/**
 * Initialize and open the AgroCycleDB IndexedDB database
 */
export async function openDB() {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  const idb = getIDBFactory();
  if (!idb) {
    console.warn("[IndexedDB] IndexedDB is not supported in this environment. Falling back to memory/local fallback.");
    return null;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Iterate through store configurations and create missing object stores & indexes
      for (const [storeName, config] of Object.entries(STORE_CONFIGS)) {
        let store;
        if (!db.objectStoreNames.contains(storeName)) {
          store = db.createObjectStore(storeName, { keyPath: config.keyPath });
        } else {
          store = request.transaction.objectStore(storeName);
        }

        if (config.indexes) {
          for (const idx of config.indexes) {
            if (!store.indexNames.contains(idx.name)) {
              store.createIndex(idx.name, idx.keyPath, { unique: Boolean(idx.unique) });
            }
          }
        }
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      
      // Handle abnormal termination or version change
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
        dbPromise = null;
      };
      
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error("[IndexedDB] Failed to open AgroCycleDB:", event.target.error);
      dbPromise = null;
      reject(event.target.error);
    };

    request.onblocked = () => {
      console.warn("[IndexedDB] Database upgrade blocked. Please close other open tabs.");
    };
  });

  return dbPromise;
}

/**
 * Helper to execute a transaction on an object store
 */
async function withStore(storeName, mode, callback) {
  const db = await openDB();
  if (!db) {
    throw new Error(`[IndexedDB] Database not available for store "${storeName}"`);
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = (e) => reject(tx.error || new Error("Transaction aborted"));
      tx.onerror = (e) => reject(tx.error || new Error("Transaction error"));

      result = callback(store);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieve a record by its primary key
 */
export async function get(storeName, key) {
  return withStore(storeName, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Retrieve all records from an object store
 */
export async function getAll(storeName) {
  return withStore(storeName, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Query records using an index
 */
export async function getByIndex(storeName, indexName, value) {
  return withStore(storeName, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      try {
        if (!store.indexNames || !store.indexNames.contains(indexName)) {
          resolve([]);
          return;
        }
        const index = store.index(indexName);
        const req = index.getAll(value);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Query records belonging to a canonical userId or creatorId
 */
export async function getByUserId(storeName, userId) {
  if (!userId) return [];
  try {
    // Check if creatorId index exists
    const byCreator = await getByIndex(storeName, "creatorId", userId);
    if (byCreator && byCreator.length > 0) return byCreator;
  } catch (e) {}

  try {
    // Check if userId index exists
    const byUser = await getByIndex(storeName, "userId", userId);
    if (byUser && byUser.length > 0) return byUser;
  } catch (e) {}

  // Fallback: full scan and filter
  const all = await getAll(storeName);
  return all.filter(r => r.creatorId === userId || r.userId === userId || r.id === userId);
}

/**
 * Insert or replace a single record
 */
export async function put(storeName, item) {
  if (!item) return null;
  return withStore(storeName, "readwrite", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Insert a new record (fails if primary key already exists)
 */
export async function add(storeName, item) {
  if (!item) return null;
  return withStore(storeName, "readwrite", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.add(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Update a specific record by merging changes
 */
export async function update(storeName, key, updates) {
  return withStore(storeName, "readwrite", (store) => {
    return new Promise((resolve, reject) => {
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) {
          reject(new Error(`Record with key "${key}" not found in store "${storeName}"`));
          return;
        }
        const updatedRecord = { ...existing, ...updates };
        const putReq = store.put(updatedRecord);
        putReq.onsuccess = () => resolve(updatedRecord);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  });
}

/**
 * Delete a single record by primary key
 */
export async function remove(storeName, key) {
  return withStore(storeName, "readwrite", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Clear all records in a store
 */
export async function clear(storeName) {
  return withStore(storeName, "readwrite", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Count items in a store
 */
export async function count(storeName) {
  return withStore(storeName, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Atomically bulk insert/replace items into an object store
 */
export async function bulkPut(storeName, items) {
  if (!items || items.length === 0) return [];
  return withStore(storeName, "readwrite", (store) => {
    return new Promise((resolve, reject) => {
      let completed = 0;
      let hasError = false;

      for (const item of items) {
        const req = store.put(item);
        req.onsuccess = () => {
          completed++;
          if (completed === items.length && !hasError) {
            resolve(items);
          }
        };
        req.onerror = (e) => {
          hasError = true;
          reject(req.error || new Error("Failed during bulkPut"));
        };
      }
    });
  });
}
