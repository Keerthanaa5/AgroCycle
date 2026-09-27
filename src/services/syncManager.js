/**
 * AgroCycle Synchronization Manager
 * 
 * Coordinates the automated processing of the offline action queue.
 * Detects online transitions, prevents concurrent sync loops, applies
 * max-retry policies, and notifies subscribers of sync state updates.
 */

import * as syncQueue from "./syncQueue.js";
import { SYNC_STATUS, MAX_RETRIES } from "./syncQueue.js";
import { defaultSyncAdapter } from "./syncAdapter.js";

class SyncManager {
  constructor(adapter = defaultSyncAdapter) {
    this.adapter = adapter;
    this.isSyncing = false;
    this.syncPromise = null;
    this.listeners = new Set();
    this.isOnlineOverride = null;

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        console.info("[SyncManager] Network reconnected. Processing pending sync queue...");
        this.processQueue().catch(err => console.warn("[SyncManager] Auto-sync error:", err));
      });

      // Auto-drain pending queue on application initialization if online
      if (typeof navigator !== "undefined" && navigator.onLine) {
        setTimeout(() => {
          this.processQueue().catch(err => console.warn("[SyncManager] Startup auto-sync error:", err));
        }, 1000);
      }
    }
  }

  /**
   * Set custom network status override (primarily for automated testing)
   */
  setOnlineOverride(isOnline) {
    this.isOnlineOverride = isOnline;
  }

  /**
   * Check whether network connectivity is available
   */
  isOnline() {
    if (this.isOnlineOverride !== null) {
      return Boolean(this.isOnlineOverride);
    }
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      return navigator.onLine;
    }
    return true;
  }

  /**
   * Subscribe to sync state changes
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all registered subscribers
   */
  notify(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn("[SyncManager] Subscriber notification error:", err);
      }
    }
  }

  /**
   * Process pending actions in the queue (FIFO creation order)
   * 
   * @param {string|null} userId - Filter by user (account isolation)
   * @param {Object} [customAdapter] - Optional custom sync adapter
   * @returns {Promise<{ processedCount: number, successCount: number, failureCount: number, skipped?: boolean }>}
   */
  async processQueue(userId = null, customAdapter = null) {
    if (!this.isOnline()) {
      return { processedCount: 0, successCount: 0, failureCount: 0, skipped: true, reason: "offline" };
    }

    // Single-flight lock: if sync is already running, await current cycle
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    this.isSyncing = true;
    this.notify({ type: "SYNC_START", userId });

    this.syncPromise = (async () => {
      let processedCount = 0;
      let successCount = 0;
      let failureCount = 0;

      const activeAdapter = customAdapter || this.adapter;

      try {
        const pending = await syncQueue.getPendingActions(userId);

        for (const action of pending) {
          // Check if network was lost during batch processing
          if (!this.isOnline()) {
            console.warn("[SyncManager] Network lost during sync queue processing. Halting gracefully.");
            break;
          }

          // Check max retries
          if (action.retryCount >= MAX_RETRIES) {
            await syncQueue.updateActionStatus(action.id, SYNC_STATUS.FAILED, action.error || "Exceeded maximum retry attempts");
            failureCount++;
            continue;
          }

          // Mark action as syncing
          await syncQueue.updateActionStatus(action.id, SYNC_STATUS.SYNCING);
          this.notify({ type: "ACTION_SYNCING", actionId: action.id, actionType: action.actionType });

          try {
            const result = await activeAdapter.syncAction(action);
            if (result && result.success) {
              await syncQueue.updateActionStatus(action.id, SYNC_STATUS.SYNCED);
              successCount++;
              this.notify({ type: "ACTION_SYNCED", actionId: action.id, actionType: action.actionType, result });
            } else {
              throw new Error(result?.error || "Sync adapter reported failure");
            }
          } catch (err) {
            failureCount++;
            const errorMsg = err.message || "Unknown synchronization error";
            const newRetryCount = (action.retryCount || 0) + 1;
            const newStatus = newRetryCount >= MAX_RETRIES ? SYNC_STATUS.FAILED : SYNC_STATUS.PENDING;

            await syncQueue.updateActionStatus(action.id, newStatus, errorMsg, newRetryCount);
            this.notify({ type: "ACTION_FAILED", actionId: action.id, actionType: action.actionType, error: errorMsg });
          }

          processedCount++;
        }
      } catch (err) {
        console.error("[SyncManager] Fatal error in sync loop:", err);
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
        this.notify({ 
          type: "SYNC_COMPLETE", 
          processedCount, 
          successCount, 
          failureCount 
        });
      }

      return { processedCount, successCount, failureCount };
    })();

    return this.syncPromise;
  }

  /**
   * Explicitly retry a failed sync action
   * 
   * @param {string} actionId
   * @param {Object} [customAdapter]
   */
  async retryAction(actionId, customAdapter = null) {
    if (!this.isOnline()) {
      return { success: false, reason: "offline" };
    }

    await syncQueue.resetActionForRetry(actionId);
    const result = await this.processQueue(null, customAdapter);
    return { success: result.successCount > 0 };
  }

  /**
   * Reset all failed actions for a user and trigger queue processing
   * 
   * @param {string|null} userId
   * @param {Object} [customAdapter]
   */
  async retryAllFailed(userId = null, customAdapter = null) {
    if (!this.isOnline()) {
      return { success: false, reason: "offline" };
    }

    const all = userId ? await syncQueue.getUserQueue(userId) : await syncQueue.getPendingActions(null);
    const failed = all.filter(a => a.status === SYNC_STATUS.FAILED);
    
    for (const a of failed) {
      await syncQueue.resetActionForRetry(a.id);
    }

    return this.processQueue(userId, customAdapter);
  }
}

export const syncManager = new SyncManager();
