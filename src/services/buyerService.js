/**
 * AgroCycle Registered Buyer Service (Layer C — Market Intelligence)
 *
 * Manages registered commercial buyers, food processors, aggregators, and retailers
 * with explicit demand requirements, buying radius, and verified profile status.
 */

import { localDB } from "./localDB.js";
import { enqueueAction, ACTION_TYPES } from "./syncQueue.js";
import { syncManager } from "./syncManager.js";


export const BUYER_STORE_KEY = "agrocycle_registered_buyers";

export const DEFAULT_REGISTERED_BUYERS = [
  {
    buyerId: "usr_buyer_madurai_processing",
    businessName: "Vaigai Agro Food Processors Ltd.",
    businessType: "Processing Unit",
    location: {
      latitude: 9.9391,
      longitude: 78.1217,
      city: "Madurai",
      district: "Madurai",
      state: "Tamil Nadu"
    },
    requirements: [
      {
        crop: "Tomato",
        variety: "Processing / Sauce Grade",
        quantityRequired: 1200,
        unit: "kg",
        targetPrice: 26
      },
      {
        crop: "Potato",
        variety: "Starch / Chip Grade",
        quantityRequired: 800,
        unit: "kg",
        targetPrice: 22
      }
    ],
    buyingRadiusKm: 60,
    contactInformation: {
      contactPerson: "K. Selvam (Procurement Manager)",
      phone: "9876543230",
      email: "procurement@vaigaifoods.com"
    },
    verificationStatus: "verified"
  },
  {
    buyerId: "usr_buyer_pandian_retail",
    businessName: "Pandian FreshMart Retailers",
    businessType: "Local Retailer",
    location: {
      latitude: 9.9195,
      longitude: 78.1405,
      city: "Madurai",
      district: "Madurai",
      state: "Tamil Nadu"
    },
    requirements: [
      {
        crop: "Tomato",
        variety: "Table / Fresh Market Grade",
        quantityRequired: 400,
        unit: "kg",
        targetPrice: 28
      },
      {
        crop: "Banana",
        variety: "Robusta / Grand Naine",
        quantityRequired: 600,
        unit: "kg",
        targetPrice: 20
      },
      {
        crop: "Onion",
        variety: "Bellary / Red",
        quantityRequired: 500,
        unit: "kg",
        targetPrice: 34
      }
    ],
    buyingRadiusKm: 35,
    contactInformation: {
      contactPerson: "M. Pandian (Proprietor)",
      phone: "9876543231",
      email: "orders@pandianfreshmart.com"
    },
    verificationStatus: "verified"
  },
  {
    buyerId: "usr_buyer_meenakshi_hospitality",
    businessName: "Meenakshi Grand Hotel & Catering Group",
    businessType: "Hotel / Restaurant",
    location: {
      latitude: 9.9252,
      longitude: 78.1198,
      city: "Madurai",
      district: "Madurai",
      state: "Tamil Nadu"
    },
    requirements: [
      {
        crop: "Tomato",
        variety: "Commercial Kitchen Grade",
        quantityRequired: 400,
        unit: "kg",
        targetPrice: 27
      },
      {
        crop: "Potato",
        variety: "Kitchen Grade",
        quantityRequired: 300,
        unit: "kg",
        targetPrice: 24
      }
    ],
    buyingRadiusKm: 25,
    contactInformation: {
      contactPerson: "Chef Anand Raj",
      phone: "9876543232",
      email: "kitchen@meenakshigrand.com"
    },
    verificationStatus: "verified"
  },
  {
    buyerId: "usr_buyer_theni_biomass",
    businessName: "Cumbum Valley Bio-Energy & Mulch Co.",
    businessType: "Biofuel / Biomass",
    location: {
      latitude: 10.0104,
      longitude: 77.4768,
      city: "Theni",
      district: "Theni",
      state: "Tamil Nadu"
    },
    requirements: [
      {
        crop: "Banana",
        variety: "Banana Stems & Fibre",
        quantityRequired: 2500,
        unit: "kg",
        targetPrice: 10
      },
      {
        crop: "Maize",
        variety: "Maize Stalks / Residue",
        quantityRequired: 2000,
        unit: "kg",
        targetPrice: 12
      },
      {
        crop: "Cotton",
        variety: "Cotton Stalks",
        quantityRequired: 3000,
        unit: "kg",
        targetPrice: 14
      }
    ],
    buyingRadiusKm: 90,
    contactInformation: {
      contactPerson: "V. Karthik",
      phone: "9876543233",
      email: "operations@cumbumbioenergy.in"
    },
    verificationStatus: "verified"
  },
  {
    buyerId: "usr_buyer_salem_textile",
    businessName: "Salem Cotton & Fiber Aggregators",
    businessType: "Agricultural Aggregator",
    location: {
      latitude: 11.6643,
      longitude: 78.1460,
      city: "Salem",
      district: "Salem",
      state: "Tamil Nadu"
    },
    requirements: [
      {
        crop: "Cotton",
        variety: "Raw Cotton / Bolls",
        quantityRequired: 1500,
        unit: "kg",
        targetPrice: 78
      }
    ],
    buyingRadiusKm: 80,
    contactInformation: {
      contactPerson: "R. Mani",
      phone: "9876543234",
      email: "mani@salemcotton.com"
    },
    verificationStatus: "verified"
  },
  {
    buyerId: "usr_buyer_dindigul_feed",
    businessName: "Dindigul Cattle Feed & Silage Hub",
    businessType: "Animal Feed",
    location: {
      latitude: 10.3673,
      longitude: 77.9803,
      city: "Dindigul",
      district: "Dindigul",
      state: "Tamil Nadu"
    },
    requirements: [
      {
        crop: "Maize",
        variety: "Green Fodder / Stover",
        quantityRequired: 1800,
        unit: "kg",
        targetPrice: 16
      }
    ],
    buyingRadiusKm: 70,
    contactInformation: {
      contactPerson: "Dr. G. Natarajan",
      phone: "9876543235",
      email: "info@dindigulfeed.in"
    },
    verificationStatus: "verified"
  }
];

/**
 * Retrieve all registered buyers from storage with default fallback
 */
export function getRegisteredBuyers() {
  let buyers = localDB.getData(BUYER_STORE_KEY);
  if (!buyers || buyers.length === 0) {
    buyers = DEFAULT_REGISTERED_BUYERS;
    localDB.saveData(BUYER_STORE_KEY, buyers);
  }
  return buyers;
}

/**
 * Register a new buyer or update existing profile
 */
export function saveRegisteredBuyer(buyer) {
  if (!buyer || !buyer.buyerId) return;
  const existing = getRegisteredBuyers();
  const index = existing.findIndex((b) => b.buyerId === buyer.buyerId);
  if (index >= 0) {
    existing[index] = { ...existing[index], ...buyer };
  } else {
    existing.push(buyer);
  }
  localDB.saveData(BUYER_STORE_KEY, existing);

  // Enqueue for offline sync
  try {
    enqueueAction({
      userId: buyer.buyerId,
      actionType: ACTION_TYPES.SAVE_BUYER_REQUIREMENT,
      entityType: "buyerRequirements",
      entityId: buyer.buyerId,
      payload: buyer
    }).then(() => {
      if (syncManager.isOnline()) {
        syncManager.processQueue(buyer.buyerId).catch(() => {});
      }
    }).catch(err => console.warn("[BuyerService] Enqueue sync error:", err));
  } catch (syncErr) {
    console.warn("[BuyerService] Sync enqueue warning:", syncErr);
  }
}
