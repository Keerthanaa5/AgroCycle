import { storageService } from "@/services/storageService";
import { STORES } from "@/services/indexedDB";

const DELAY_MS = 100;

// Helper to simulate network delay
const delay = (ms = DELAY_MS) => new Promise(resolve => setTimeout(resolve, ms));

const ENTITY_TO_STORE = {
  InsuranceClaim: STORES.CLAIM_DOSSIERS,
  ViabilityScan: STORES.SCAN_HISTORY,
  CropPost: STORES.AGRO_CONNECT,
  WasteMatch: STORES.MARKETPLACE_LISTINGS,
  CarbonActivity: STORES.CARBON_ACTIVITIES,
  Notification: STORES.NOTIFICATIONS
};

// Localized mock data store backed by IndexedDB and synchronized with localStorage fallback
class MockEntityStore {
  constructor(entityName) {
    this.entityName = entityName;
    this.storageKey = `agrocycle_mock_${entityName}`;
    this.storeName = ENTITY_TO_STORE[entityName] || null;
    
    if (typeof localStorage !== "undefined" && !localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify([]));
    }
  }

  getItems() {
    try {
      if (typeof localStorage === "undefined") return [];
      return JSON.parse(localStorage.getItem(this.storageKey) || "[]");
    } catch (e) {
      return [];
    }
  }

  setItems(items) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.storageKey, JSON.stringify(items));
      }
    } catch (e) {}

    if (this.storeName && Array.isArray(items)) {
      storageService.bulkPut(this.storeName, items).catch(err => {
        console.warn(`[MockEntityStore] IndexedDB bulkPut background error:`, err);
      });
    }
  }

  async list(order = "-created_date", limit = 100) {
    await delay();
    let items = [];
    if (this.storeName) {
      try {
        const idbItems = await storageService.getAll(this.storeName);
        if (idbItems && idbItems.length > 0) {
          items = idbItems;
        }
      } catch (e) {}
    }

    if (items.length === 0) {
      items = this.getItems();
    }

    if (order.startsWith("-")) items.reverse();
    return items.slice(0, limit);
  }

  async create(data) {
    await delay();
    const items = this.getItems();
    const newItem = {
      id: data.id || Math.random().toString(36).substring(2, 9),
      created_date: data.created_date || new Date().toISOString(),
      ...data,
    };

    items.push(newItem);
    this.setItems(items);

    if (this.storeName) {
      try {
        await storageService.set(this.storeName, newItem);
      } catch (e) {}
    }

    return newItem;
  }

  async update(id, updates) {
    await delay();
    const items = this.getItems();
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) {
      // If not in localStorage items, attempt to update in IndexedDB directly
      if (this.storeName) {
        try {
          const updated = await storageService.update(this.storeName, id, updates);
          return updated;
        } catch (e) {}
      }
      throw new Error("Not found");
    }

    items[index] = { ...items[index], ...updates };
    this.setItems(items);

    if (this.storeName) {
      try {
        await storageService.update(this.storeName, id, updates);
      } catch (e) {}
    }

    return items[index];
  }

  async delete(id) {
    await delay();
    const items = this.getItems();
    const filtered = items.filter(i => String(i.id) !== String(id));
    this.setItems(filtered);

    if (this.storeName) {
      try {
        await storageService.delete(this.storeName, id);
      } catch (e) {}
    }
    return true;
  }

  async filter(criteria) {
    await delay();
    let items = [];
    if (this.storeName) {
      try {
        const idbItems = await storageService.getAll(this.storeName);
        if (idbItems && idbItems.length > 0) items = idbItems;
      } catch (e) {}
    }
    if (items.length === 0) {
      items = this.getItems();
    }

    return items.filter(item => {
      for (const [key, value] of Object.entries(criteria)) {
        if (item[key] !== value) return false;
      }
      return true;
    });
  }

  subscribe(callback) {
    // Mock subscription does nothing for now
    return () => {}; // return unsubscribe function
  }
}

// Proxied mock entities
const mockEntities = new Proxy({}, {
  get: (target, entityName) => {
    if (!target[entityName]) {
      target[entityName] = new MockEntityStore(entityName);
    }
    return target[entityName];
  }
});

export const mockApi = {
  auth: {
    async me() {
      await delay(50);
      try {
        if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem("user");
          if (raw) {
            const user = JSON.parse(raw);
            return {
              id: user.userId || user.id || "mock_user_1",
              full_name: user.name || user.full_name || "Demo Farmer",
              email: user.email || "farmer@agrocycle.test"
            };
          }
        }
      } catch (e) {}

      return {
        id: "mock_user_1",
        full_name: "Demo Farmer",
        email: "demo@agrocycle.test"
      };
    },
    async login() { await delay(50); },
    logout() { window.location.href = "/"; },
    redirectToLogin() {}
  },
  entities: mockEntities,
  integrations: {
    Core: {
      async UploadFile({ file }) {
        await delay();
        if (file) {
          const file_url = URL.createObjectURL(file);
          return { file_url };
        }
        return { file_url: "https://via.placeholder.com/300" };
      },
      async InvokeLLM({ prompt }) {
        await delay(500);
        if (prompt && prompt.includes("potential buyers")) {
          return {
            buyers: [
              { buyer_type: "food_processing", name: "GreenValley Foods Ltd.", estimated_price_per_kg: 10, distance_km: 15, reason: "Looking for slightly damaged crops for starch extraction." },
              { buyer_type: "hotel", name: "Sunrise Hotel Group", estimated_price_per_kg: 12, distance_km: 5, reason: "Interested in slightly bruised produce for soups." }
            ]
          };
        } else if (prompt && prompt.includes("insurance claim validity")) {
          return { analysis: "The damage shown matches weather reports. Highly valid.", estimated_loss_percentage: 85, recommended_action: "Approve for full amount." };
        } else if (prompt && prompt.includes("silage center")) {
          return { centers: [{ name: "AgriMax Silage Partners", distance_km: 12, price_per_ton: 1500, rating: 4.5, features: ["Free Pickup", "Fast Processing"] }] };
        } else if (prompt && prompt.includes("EXPERT ANALYSIS MODE")) {
          const seed = Math.random();
          if (seed > 0.6) {
            return {
              cropName: "Wheat", condition: "low", usablePercentage: 85, damagePercentage: 15,
              description: "Crop shows robust growth with excellent grain integrity. Minor surface blemishes do not affect overall yield quality.",
              recommendedFeature: "AgroConnect Community", action: "Sell to Buyers",
              reason: "Crop is healthy and highly suitable for direct market sale at a premium price.",
              date: new Date().toISOString().split('T')[0]
            };
          } else if (seed > 0.3) {
            return {
              cropName: "Wheat", condition: "medium", usablePercentage: 55, damagePercentage: 45,
              description: "Moderate pest damage visible on the outer foliage. The core crop is stable but requires immediate harvest sorting.",
              recommendedFeature: "Silage Bank Network", action: "Feed to Cattle or Sell for Industrial Use",
              reason: "While partially damaged for premium markets, it remains highly usable for secondary industrial processing or livestock feed.",
              date: new Date().toISOString().split('T')[0]
            };
          } else {
            return {
              cropName: "Wheat", condition: "critical", usablePercentage: 15, damagePercentage: 85,
              description: "Field analysis indicates severe necrotic tissue consistent with advanced crop failure. The moisture integrity of the viable grain is significantly compromised.",
              recommendedFeature: "Carbon Cash", action: "Convert to compost / manure instead of burning",
              reason: "Given the 85% damage magnitude, you should avoid burning the remnant stalks. Composting the biodegradable waste will drastically reduce carbon emissions and earn carbon credits.",
              date: new Date().toISOString().split('T')[0]
            };
          }
        } else if (prompt && prompt.includes("intercropping")) {
          return { recommendations: [{ crop: "Legumes / Millets", benefit: "Nitrogen fixation.", water_efficiency: "High", roi_estimate: "30-50% increase" }], risk_factors: "Avoid overwatering.", soil_health_impact: "Improves organic matter." };
        }
        return { analysis: "This is a mock AI response." };
      }
    }
  }
};
