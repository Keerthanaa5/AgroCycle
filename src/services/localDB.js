import { storageService } from "./storageService.js";
import { STORES } from "./indexedDB.js";

export const KEYS = {
  AGRO: "agroPosts",
  WASTE: "wastePosts",
  CLAIMS: "claims",
  CARBON: "carbonLogs",
  LOGISTICS_SHIPMENTS: "logisticsShipments",
  LOGISTICS_DRIVERS: "logisticsDrivers",
  LOGISTICS_VEHICLES: "logisticsVehicles"
};

// Map localDB KEYS to IndexedDB Store Names
const KEY_TO_STORE = {
  [KEYS.AGRO]: STORES.AGRO_CONNECT,
  [KEYS.WASTE]: STORES.MARKETPLACE_LISTINGS,
  [KEYS.CLAIMS]: STORES.CLAIM_DOSSIERS,
  [KEYS.CARBON]: STORES.CARBON_ACTIVITIES,
  [KEYS.LOGISTICS_SHIPMENTS]: STORES.LOGISTICS_SHIPMENTS,
  [KEYS.LOGISTICS_DRIVERS]: STORES.LOGISTICS_DRIVERS,
  [KEYS.LOGISTICS_VEHICLES]: STORES.LOGISTICS_VEHICLES
};

const memoryStore = new Map();

/**
 * Synchronous localDB bridge with background IndexedDB persistence.
 * Preserves 100% backward compatibility for existing pages while persisting
 * data into IndexedDB (AgroCycleDB).
 */
export const localDB = {
  getData: (key) => {
    try {
      if (typeof localStorage === "undefined") {
        return memoryStore.get(key) || [];
      }
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      console.warn(`[localDB] Error reading key "${key}" from localStorage:`, e);
      return memoryStore.get(key) || [];
    }
  },
  
  saveData: (key, data) => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, JSON.stringify(data));
      } else {
        memoryStore.set(key, data);
      }
    } catch (e) {
      console.warn(`[localDB] Error writing key "${key}" to localStorage:`, e);
      memoryStore.set(key, data);
    }

    // Mirror to IndexedDB in background
    const targetStore = KEY_TO_STORE[key];
    if (targetStore && Array.isArray(data)) {
      storageService.bulkPut(targetStore, data).catch(err => {
        console.warn(`[localDB] Background IndexedDB bulkPut error for ${targetStore}:`, err);
      });
    }
  },
  
  addItem: (key, item) => {
    const existing = localDB.getData(key);
    localDB.saveData(key, [item, ...existing]);

    // Mirror item to IndexedDB in background
    const targetStore = KEY_TO_STORE[key];
    if (targetStore && item) {
      storageService.set(targetStore, item).catch(err => {
        console.warn(`[localDB] Background IndexedDB set error for ${targetStore}:`, err);
      });
    }
  },
  
  updateItem: (key, id, data) => {
    const existing = localDB.getData(key);
    const updated = existing.map(item => item.id === id ? { ...item, ...data } : item);
    localDB.saveData(key, updated);

    // Mirror item update to IndexedDB in background
    const targetStore = KEY_TO_STORE[key];
    if (targetStore && id) {
      storageService.update(targetStore, id, data).catch(err => {
        console.warn(`[localDB] Background IndexedDB update error for ${targetStore}:`, err);
      });
    }
  },
  
  deleteItem: (key, id) => {
    const existing = localDB.getData(key);
    const filtered = existing.filter(item => item.id !== id);
    localDB.saveData(key, filtered);

    // Mirror item deletion to IndexedDB in background
    const targetStore = KEY_TO_STORE[key];
    if (targetStore && id) {
      storageService.delete(targetStore, id).catch(err => {
        console.warn(`[localDB] Background IndexedDB delete error for ${targetStore}:`, err);
      });
    }
  },

  // Asynchronous direct IndexedDB methods for modern callers
  async: {
    getData: async (key) => {
      const targetStore = KEY_TO_STORE[key];
      if (!targetStore) return localDB.getData(key);
      try {
        const idbData = await storageService.getAll(targetStore);
        if (idbData && idbData.length > 0) return idbData;
      } catch (e) {}
      return localDB.getData(key);
    },

    saveData: async (key, data) => {
      localDB.saveData(key, data);
      const targetStore = KEY_TO_STORE[key];
      if (targetStore && Array.isArray(data)) {
        await storageService.bulkPut(targetStore, data);
      }
    },

    addItem: async (key, item) => {
      localDB.addItem(key, item);
      const targetStore = KEY_TO_STORE[key];
      if (targetStore && item) {
        await storageService.set(targetStore, item);
      }
    },

    updateItem: async (key, id, data) => {
      localDB.updateItem(key, id, data);
      const targetStore = KEY_TO_STORE[key];
      if (targetStore && id) {
        await storageService.update(targetStore, id, data);
      }
    },

    deleteItem: async (key, id) => {
      localDB.deleteItem(key, id);
      const targetStore = KEY_TO_STORE[key];
      if (targetStore && id) {
        await storageService.delete(targetStore, id);
      }
    }
  }
};
