/**
 * AgroCycle Storage Service
 * 
 * Provides an abstraction layer connecting UI components to IndexedDB (AgroCycleDB),
 * executing non-destructive migration from legacy localStorage, and ensuring
 * resilient offline-first data operations.
 */

import * as db from "./indexedDB.js";
import { STORES } from "./indexedDB.js";

export const MIGRATION_VERSION = 1;
export const MIGRATION_META_KEY = "indexedDBMigrationVersion";

let migrationPromise = null;

/**
 * Perform safe, one-time migration from localStorage to IndexedDB.
 * 
 * Guarantees:
 * 1. Non-destructive: original localStorage data is preserved as fallback.
 * 2. Idempotent: checks migration version flag before executing.
 * 3. Atomic store population with duplicate prevention.
 * 4. Preserves canonical user.userId and creatorId ownership identifiers.
 */
export async function runMigrationIfNeeded() {
  if (migrationPromise) {
    await migrationPromise;
  }

  try {
    const meta = await db.get(STORES.SYSTEM_META, MIGRATION_META_KEY);
    if (meta && Number(meta.version) >= MIGRATION_VERSION) {
      return { migrated: false, reason: "Already up to date", version: meta.version };
    }
  } catch (e) {}

  migrationPromise = (async () => {
    try {
      await db.openDB();

      // Check migration status in IndexedDB systemMeta store
      const meta = await db.get(STORES.SYSTEM_META, MIGRATION_META_KEY);
      if (meta && Number(meta.version) >= MIGRATION_VERSION) {
        return { migrated: false, reason: "Already up to date", version: meta.version };
      }

      console.info("[StorageService] Running one-time migration from localStorage to IndexedDB...");

      // Helper to safely read from localStorage
      const readLS = (key) => {
        try {
          if (typeof localStorage === "undefined") return null;
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        } catch (e) {
          console.warn(`[StorageService] Failed reading localStorage key "${key}":`, e);
          return null;
        }
      };

      // 1. Migrate Registered Accounts / Users
      const rawAccounts = readLS("agrocycle_registered_accounts") || [];
      const userList = Array.isArray(rawAccounts) ? rawAccounts : [];
      for (const account of userList) {
        const canonicalId = account.userId || account.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const normalized = {
          ...account,
          userId: canonicalId,
          id: canonicalId,
          roles: Array.isArray(account.roles) ? account.roles : [account.role || "farmer"],
          activeRole: account.activeRole || account.role || "farmer",
          verificationStatus: account.verificationStatus || "pending"
        };
        await db.put(STORES.USERS, normalized);
      }

      // 2. Migrate Current Active User Session
      const activeUser = readLS("user");
      if (activeUser && (activeUser.userId || activeUser.id)) {
        const canonicalUserId = activeUser.userId || activeUser.id;
        const normalizedUser = {
          ...activeUser,
          userId: canonicalUserId,
          id: canonicalUserId
        };
        await db.put(STORES.SESSIONS, { ...normalizedUser, id: "current_user" });
        await db.put(STORES.USERS, normalizedUser);
      }

      // 3. Migrate Silage Centers
      const rawCenters = readLS("silageCenters") || [];
      if (Array.isArray(rawCenters)) {
        for (const center of rawCenters) {
          if (center && (center.id || center.name)) {
            const centerId = center.id || `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            await db.put(STORES.SILAGE_CENTERS, { ...center, id: centerId });
          }
        }
      }

      // 4. Migrate Silage Bookings
      const rawBookings = readLS("silageBookings") || [];
      if (Array.isArray(rawBookings)) {
        for (const booking of rawBookings) {
          if (booking && (booking.id || booking.centerId)) {
            const bookingId = booking.id || `sb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            await db.put(STORES.SILAGE_BOOKINGS, { ...booking, id: bookingId });
          }
        }
      }

      // 5. Migrate Waste Marketplace Listings
      const rawWaste = readLS("wastePosts") || readLS("agrocycle_mock_WasteMatch") || [];
      if (Array.isArray(rawWaste)) {
        for (const item of rawWaste) {
          if (item && (item.id || item.title || item.crop)) {
            const itemId = String(item.id || `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
            await db.put(STORES.MARKETPLACE_LISTINGS, { ...item, id: itemId });
          }
        }
      }

      // 6. Migrate AgroConnect Community Posts
      const rawAgro = readLS("agroPosts") || readLS("agrocycle_mock_CropPost") || [];
      if (Array.isArray(rawAgro)) {
        for (const item of rawAgro) {
          if (item && (item.id || item.title || item.crop)) {
            const itemId = String(item.id || `ap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
            await db.put(STORES.AGRO_CONNECT, { ...item, id: itemId });
          }
        }
      }

      // 7. Migrate Carbon Cash Activities
      const rawCarbon = readLS("carbonLogs") || readLS("agrocycle_mock_CarbonActivity") || [];
      if (Array.isArray(rawCarbon)) {
        for (const item of rawCarbon) {
          if (item && (item.id || item.activity_type)) {
            const itemId = String(item.id || `ca_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
            await db.put(STORES.CARBON_ACTIVITIES, { ...item, id: itemId });
          }
        }
      }

      // 8. Migrate Claim Rocket Dossiers / Insurance Claims
      const rawClaims = readLS("claims") || readLS("agrocycle_mock_InsuranceClaim") || [];
      if (Array.isArray(rawClaims)) {
        for (const item of rawClaims) {
          if (item && (item.id || item.crop_type || item.policy_number)) {
            const itemId = String(item.id || `ic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
            await db.put(STORES.CLAIM_DOSSIERS, { ...item, id: itemId });
          }
        }
      }

      // 9. Migrate Viability Scan History
      const rawScans = readLS("agrocycle_mock_ViabilityScan") || [];
      if (Array.isArray(rawScans)) {
        for (const item of rawScans) {
          if (item && (item.id || item.cropName)) {
            const itemId = String(item.id || `vs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
            await db.put(STORES.SCAN_HISTORY, { ...item, id: itemId });
          }
        }
      }

      // 10. Migrate Notifications
      const rawNotifs = readLS("agrocycle_mock_Notification") || [];
      if (Array.isArray(rawNotifs)) {
        for (const item of rawNotifs) {
          if (item && item.id) {
            await db.put(STORES.NOTIFICATIONS, { ...item, id: String(item.id) });
          }
        }
      }

      // Record successful migration in IndexedDB
      await db.put(STORES.SYSTEM_META, {
        key: MIGRATION_META_KEY,
        version: MIGRATION_VERSION,
        migratedAt: new Date().toISOString()
      });

      console.info("[StorageService] Migration completed successfully into IndexedDB (AgroCycleDB).");
      return { migrated: true, version: MIGRATION_VERSION };
    } catch (err) {
      console.error("[StorageService] Migration encountered error, keeping localStorage intact:", err);
      return { migrated: false, error: err.message };
    }
  })();

  return migrationPromise;
}

// Auto-trigger migration on import in browser environment
if (typeof window !== "undefined") {
  runMigrationIfNeeded().catch(e => console.warn("[StorageService] Background migration init:", e));
}

/**
 * Storage Service Unified API
 */
export const storageService = {
  STORES,

  // Core Generic Database Methods
  async get(storeName, key) {
    await runMigrationIfNeeded();
    return db.get(storeName, key);
  },

  async getAll(storeName) {
    await runMigrationIfNeeded();
    return db.getAll(storeName);
  },

  async getByIndex(storeName, indexName, value) {
    await runMigrationIfNeeded();
    return db.getByIndex(storeName, indexName, value);
  },

  async getByUserId(storeName, userId) {
    await runMigrationIfNeeded();
    return db.getByUserId(storeName, userId);
  },

  async set(storeName, item) {
    await runMigrationIfNeeded();
    return db.put(storeName, item);
  },

  async add(storeName, item) {
    await runMigrationIfNeeded();
    return db.add(storeName, item);
  },

  async update(storeName, key, updates) {
    await runMigrationIfNeeded();
    return db.update(storeName, key, updates);
  },

  async delete(storeName, key) {
    await runMigrationIfNeeded();
    return db.remove(storeName, key);
  },

  async clear(storeName) {
    await runMigrationIfNeeded();
    return db.clear(storeName);
  },

  async count(storeName) {
    await runMigrationIfNeeded();
    return db.count(storeName);
  },

  async bulkPut(storeName, items) {
    await runMigrationIfNeeded();
    return db.bulkPut(storeName, items);
  },

  // --------------------------------------------------------------------------
  // Specialized Entity Operations
  // --------------------------------------------------------------------------

  // USERS & ACCOUNTS
  users: {
    async getAll() {
      return storageService.getAll(STORES.USERS);
    },
    async get(userId) {
      return storageService.get(STORES.USERS, userId);
    },
    async save(user) {
      const canonicalId = user.userId || user.id;
      const normalized = { ...user, userId: canonicalId, id: canonicalId };
      return storageService.set(STORES.USERS, normalized);
    },
    async getByPhone(phone) {
      const cleaned = phone ? String(phone).trim() : "";
      if (!cleaned) return null;
      const matches = await storageService.getByIndex(STORES.USERS, "phone", cleaned);
      return matches && matches.length > 0 ? matches[0] : null;
    }
  },

  // SESSIONS
  sessions: {
    async getCurrentUser() {
      const session = await storageService.get(STORES.SESSIONS, "current_user");
      return session || null;
    },
    async setCurrentUser(user) {
      if (!user) {
        return storageService.delete(STORES.SESSIONS, "current_user");
      }
      const canonicalId = user.userId || user.id;
      const sessionRecord = { ...user, id: "current_user", userId: canonicalId };
      return storageService.set(STORES.SESSIONS, sessionRecord);
    },
    async clear() {
      return storageService.delete(STORES.SESSIONS, "current_user");
    }
  },

  // SILAGE CENTERS
  silageCenters: {
    async getAll() {
      return storageService.getAll(STORES.SILAGE_CENTERS);
    },
    async get(id) {
      return storageService.get(STORES.SILAGE_CENTERS, id);
    },
    async save(center) {
      return storageService.set(STORES.SILAGE_CENTERS, center);
    },
    async delete(id) {
      return storageService.delete(STORES.SILAGE_CENTERS, id);
    },
    async getByCreator(creatorId) {
      return storageService.getByUserId(STORES.SILAGE_CENTERS, creatorId);
    }
  },

  // SILAGE BOOKINGS
  silageBookings: {
    async getAll() {
      return storageService.getAll(STORES.SILAGE_BOOKINGS);
    },
    async get(id) {
      return storageService.get(STORES.SILAGE_BOOKINGS, id);
    },
    async save(booking) {
      return storageService.set(STORES.SILAGE_BOOKINGS, booking);
    },
    async update(id, updates) {
      return storageService.update(STORES.SILAGE_BOOKINGS, id, updates);
    },
    async delete(id) {
      return storageService.delete(STORES.SILAGE_BOOKINGS, id);
    },
    async getByCreator(creatorId) {
      return storageService.getByUserId(STORES.SILAGE_BOOKINGS, creatorId);
    },
    async getByCenter(centerId) {
      return storageService.getByIndex(STORES.SILAGE_BOOKINGS, "centerId", centerId);
    }
  },

  // MARKETPLACE LISTINGS (Urban Waste Matcher)
  marketplace: {
    async getAll() {
      return storageService.getAll(STORES.MARKETPLACE_LISTINGS);
    },
    async get(id) {
      return storageService.get(STORES.MARKETPLACE_LISTINGS, id);
    },
    async save(listing) {
      return storageService.set(STORES.MARKETPLACE_LISTINGS, listing);
    },
    async update(id, updates) {
      return storageService.update(STORES.MARKETPLACE_LISTINGS, id, updates);
    },
    async delete(id) {
      return storageService.delete(STORES.MARKETPLACE_LISTINGS, id);
    },
    async getByCreator(creatorId) {
      return storageService.getByUserId(STORES.MARKETPLACE_LISTINGS, creatorId);
    }
  },

  // AGROCONNECT (Community Exchange)
  agroConnect: {
    async getAll() {
      return storageService.getAll(STORES.AGRO_CONNECT);
    },
    async get(id) {
      return storageService.get(STORES.AGRO_CONNECT, id);
    },
    async save(post) {
      return storageService.set(STORES.AGRO_CONNECT, post);
    },
    async update(id, updates) {
      return storageService.update(STORES.AGRO_CONNECT, id, updates);
    },
    async delete(id) {
      return storageService.delete(STORES.AGRO_CONNECT, id);
    },
    async getByCreator(creatorId) {
      return storageService.getByUserId(STORES.AGRO_CONNECT, creatorId);
    }
  },

  // CARBON CASH ACTIVITIES & OFFERS
  carbon: {
    async getAllActivities() {
      return storageService.getAll(STORES.CARBON_ACTIVITIES);
    },
    async getActivity(id) {
      return storageService.get(STORES.CARBON_ACTIVITIES, id);
    },
    async saveActivity(activity) {
      return storageService.set(STORES.CARBON_ACTIVITIES, activity);
    },
    async updateActivity(id, updates) {
      return storageService.update(STORES.CARBON_ACTIVITIES, id, updates);
    },
    async deleteActivity(id) {
      return storageService.delete(STORES.CARBON_ACTIVITIES, id);
    },
    async getActivitiesByCreator(creatorId) {
      return storageService.getByUserId(STORES.CARBON_ACTIVITIES, creatorId);
    },
    async getOffers(activityId) {
      return storageService.getByIndex(STORES.CARBON_OFFERS, "activityId", activityId);
    },
    async saveOffer(offer) {
      return storageService.set(STORES.CARBON_OFFERS, offer);
    },
    async updateOffer(id, updates) {
      return storageService.update(STORES.CARBON_OFFERS, id, updates);
    }
  },

  // CLAIM ROCKET (Dossiers / Insurance Claims)
  claims: {
    async getAll() {
      return storageService.getAll(STORES.CLAIM_DOSSIERS);
    },
    async get(id) {
      return storageService.get(STORES.CLAIM_DOSSIERS, id);
    },
    async save(claim) {
      return storageService.set(STORES.CLAIM_DOSSIERS, claim);
    },
    async update(id, updates) {
      return storageService.update(STORES.CLAIM_DOSSIERS, id, updates);
    },
    async delete(id) {
      return storageService.delete(STORES.CLAIM_DOSSIERS, id);
    },
    async getByCreator(creatorId) {
      return storageService.getByUserId(STORES.CLAIM_DOSSIERS, creatorId);
    }
  },

  // SCAN HISTORY (Viability Scanner)
  scans: {
    async getAll() {
      return storageService.getAll(STORES.SCAN_HISTORY);
    },
    async get(id) {
      return storageService.get(STORES.SCAN_HISTORY, id);
    },
    async save(scan) {
      return storageService.set(STORES.SCAN_HISTORY, scan);
    },
    async delete(id) {
      return storageService.delete(STORES.SCAN_HISTORY, id);
    },
    async getByCreator(creatorId) {
      return storageService.getByUserId(STORES.SCAN_HISTORY, creatorId);
    }
  },

  // NOTIFICATIONS
  notifications: {
    async getAll(userId) {
      if (userId) {
        return storageService.getByUserId(STORES.NOTIFICATIONS, userId);
      }
      return storageService.getAll(STORES.NOTIFICATIONS);
    },
    async save(notif) {
      return storageService.set(STORES.NOTIFICATIONS, notif);
    },
    async update(id, updates) {
      return storageService.update(STORES.NOTIFICATIONS, id, updates);
    },
    async delete(id) {
      return storageService.delete(STORES.NOTIFICATIONS, id);
    }
  },

  // USER LOCATIONS (GPS Infrastructure)
  locations: {
    async get(id) {
      return storageService.get(STORES.USER_LOCATIONS, id);
    },
    async getByUserId(userId) {
      return storageService.getByUserId(STORES.USER_LOCATIONS, userId);
    },
    async save(loc) {
      return storageService.set(STORES.USER_LOCATIONS, loc);
    },
    async update(id, updates) {
      return storageService.update(STORES.USER_LOCATIONS, id, updates);
    },
    async delete(id) {
      return storageService.delete(STORES.USER_LOCATIONS, id);
    }
  }
};

