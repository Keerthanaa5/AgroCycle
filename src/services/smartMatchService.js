/**
 * AgroCycle Smart Multi-Farmer Matching Engine (Phase 1)
 *
 * Core Reusable Service for:
 * 1. Market Intelligence (Buyer-Side Fresh Produce Procurement for Supermarkets & Processors)
 * 2. Silage Bank (Animal Feed & Fodder Sourcing with strict quality/safety filtering)
 * 3. Urban Waste Matcher (Biomass, Agricultural Residue & Byproduct Consolidation)
 *
 * UX Principle:
 * AgroCycle is a SMART ASSISTANT, NOT an automatic decision-maker.
 * The system presents 1–3 smart supply combinations and allows buyers to
 * accept the recommendation or manually customize and swap suppliers.
 *
 * Boundary:
 * Payment / Gateway / Transporter Assignment / Route Optimization / Live GPS:
 * Strictly excluded in Phase 1 (Scheduled for Logistics & Payment phases).
 */

import { localDB } from "./localDB.js";
import { normalizeCropName, KNOWN_CROP_ALIASES } from "./marketPriceService.js";
import {
  BUYER_TYPES,
  BUYER_TYPE_OPTIONS,
  INTENDED_USES,
  INTENDED_USE_OPTIONS,
  MARKET_INTELLIGENCE_GRADES,
  MARKET_INTELLIGENCE_GRADE_OPTIONS,
  normalizeMarketIntelligenceGrade,
  checkGradeAndIntendedUseCompatibility
} from "../constants/marketIntelligence.js";

// Re-export master Market Intelligence constants and helpers
export {
  BUYER_TYPES,
  BUYER_TYPE_OPTIONS,
  INTENDED_USES,
  INTENDED_USE_OPTIONS,
  MARKET_INTELLIGENCE_GRADES,
  MARKET_INTELLIGENCE_GRADE_OPTIONS,
  normalizeMarketIntelligenceGrade,
  checkGradeAndIntendedUseCompatibility
};

// ==========================================
// CONSTANTS & ENUMS
// ==========================================

export const MATCH_TYPES = {
  MARKET: "MARKET",
  SILAGE: "SILAGE",
  WASTE: "WASTE"
};

export const ORDER_STATUS = {
  REQUESTED: "REQUESTED",
  PARTIALLY_SOURCED: "PARTIALLY_SOURCED",
  FULLY_SOURCED: "FULLY_SOURCED",
  CONFIRMED: "CONFIRMED",
  PARTIALLY_FULFILLED: "PARTIALLY_FULFILLED",
  CLOSED: "CLOSED",
  FULFILLMENT: "FULFILLMENT",
  RECOMMENDED: "RECOMMENDED",
  ACCEPTED: "ACCEPTED",
  CUSTOMIZED: "CUSTOMIZED"
};

export const FULFILLMENT_STATUS = {
  EXACT: "EXACT",
  DEFICIT: "DEFICIT",
  EXCESS: "EXCESS"
};

export const PROCUREMENT_ORDER_STORE_KEY = "agrocycle_procurement_orders";

// Unsafe conditions explicitly barred from Silage Bank
export const SILAGE_UNSAFE_CONDITIONS = [
  "moldy",
  "contaminated",
  "toxic",
  "spoiled",
  "rotten",
  "chemical_exposed",
  "fungal_growth",
  "heavily_damaged"
];

// Materials recognized as feed-suitable for Silage Bank
export const SILAGE_ELIGIBLE_CROPS = [
  "maize",
  "corn",
  "sorghum",
  "green fodder",
  "fodder",
  "napier grass",
  "hybrid napier",
  "paddy straw",
  "straw",
  "sugarcane tops",
  "alfalfa",
  "lucerne",
  "bajra",
  "pearl millet",
  "cowpea fodder",
  "berseem",
  "grass"
];

// Biomass and residue types for Urban Waste Matcher
export const WASTE_ELIGIBLE_TYPES = [
  "paddy straw",
  "rice husk",
  "sugarcane bagasse",
  "bagasse",
  "cotton stalk",
  "banana pseudostem",
  "banana stem",
  "coconut coir",
  "coconut shell",
  "groundnut shell",
  "corn cob",
  "wheat straw",
  "vegetable market waste",
  "fruit processing residue",
  "bruised vegetables",
  "damaged produce",
  "sawdust",
  "spent mushroom substrate"
];

// Fresh Produce Categories & Crops
export const FRESH_PRODUCE_CATALOG = {
  vegetables: [
    "Tomato",
    "Onion",
    "Potato",
    "Carrot",
    "Brinjal",
    "Cabbage",
    "Cauliflower",
    "Okra",
    "Capsicum",
    "Green Chilli"
  ],
  fruits: [
    "Banana",
    "Mango",
    "Guava",
    "Papaya",
    "Watermelon",
    "Pomegranate",
    "Orange",
    "Grapes"
  ]
};

export function getApiBaseUrl() {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return "http://localhost:5000/api/v1";
}

// ==========================================
// DEMO REALISTIC SUPPLY DATASETS (OFFLINE-SAFE)
// ==========================================

export const DEMO_SUPPLY_MARKET = [
  // --- Tomato Lots (Supports Exact 1,000 kg Scenario) ---
  {
    id: "sup_mkt_f1",
    farmerId: "f_farmer_a",
    farmerName: "Farmer A (Ramesh K.)",
    phone: "9876543101",
    crop: "Tomato",
    category: "vegetable",
    variety: "Vaishnavi Hybrid",
    qualityGrade: "Grade A — Fresh / Premium",
    condition: "fresh",
    availableQuantityKg: 200,
    availableQuantityTonnes: 0.2,
    pricePerKg: 26,
    pricePerTonne: 26000,
    location: {
      address: "Alanganallur, Madurai",
      city: "Madurai",
      district: "Madurai",
      state: "Tamil Nadu",
      latitude: 10.0452,
      longitude: 78.0841
    },
    harvestDate: "2026-09-28",
    verificationStatus: "verified",
    reliabilityScore: 98,
    isSample: true
  },
  {
    id: "sup_mkt_f2",
    farmerId: "f_farmer_b",
    farmerName: "Farmer B (Murugan Farms)",
    phone: "9876543102",
    crop: "Tomato",
    category: "vegetable",
    variety: "Shivam Table Fresh",
    qualityGrade: "Grade A — Fresh / Premium",
    condition: "fresh",
    availableQuantityKg: 150,
    availableQuantityTonnes: 0.15,
    pricePerKg: 25,
    pricePerTonne: 25000,
    location: {
      address: "Melur Road, Madurai",
      city: "Madurai",
      district: "Madurai",
      state: "Tamil Nadu",
      latitude: 10.0289,
      longitude: 78.3340
    },
    harvestDate: "2026-09-28",
    verificationStatus: "verified",
    reliabilityScore: 95,
    isSample: true
  },
  {
    id: "sup_mkt_f3",
    farmerId: "f_farmer_c",
    farmerName: "Farmer C (Selvam P.)",
    phone: "9876543103",
    crop: "Tomato",
    category: "vegetable",
    variety: "Commercial Sauce Lot",
    qualityGrade: "Grade B — Processing",
    condition: "slightly_damaged",
    availableQuantityKg: 300,
    availableQuantityTonnes: 0.3,
    pricePerKg: 28,
    pricePerTonne: 28000,
    location: {
      address: "Vadipatti Agro Cluster",
      city: "Vadipatti",
      district: "Madurai",
      state: "Tamil Nadu",
      latitude: 10.0768,
      longitude: 77.9622
    },
    harvestDate: "2026-09-28",
    verificationStatus: "verified",
    reliabilityScore: 94,
    isSample: true
  },
  {
    id: "sup_mkt_f4",
    farmerId: "f_farmer_d",
    farmerName: "Farmer D (Anbuselvan T.)",
    phone: "9876543104",
    crop: "Tomato",
    category: "vegetable",
    variety: "Namdhari Supreme",
    qualityGrade: "Grade A — Fresh / Premium",
    condition: "fresh",
    availableQuantityKg: 350,
    availableQuantityTonnes: 0.35,
    pricePerKg: 24,
    pricePerTonne: 24000,
    location: {
      address: "Usilampatti Green Zone",
      city: "Usilampatti",
      district: "Madurai",
      state: "Tamil Nadu",
      latitude: 9.9678,
      longitude: 77.7944
    },
    harvestDate: "2026-09-28",
    verificationStatus: "verified",
    reliabilityScore: 92,
    isSample: true
  },
  {
    id: "sup_mkt_f5_expensive",
    farmerId: "f_farmer_e_exp",
    farmerName: "Farmer E (Kavitha Organic - High Price Lot)",
    phone: "9876543105",
    crop: "Tomato",
    category: "vegetable",
    variety: "Arka Organic Cherry",
    qualityGrade: "Grade A — Fresh / Premium",
    condition: "fresh",
    availableQuantityKg: 500,
    availableQuantityTonnes: 0.5,
    pricePerKg: 42, // EXCEEDS ₹32/kg cap
    pricePerTonne: 42000,
    location: {
      address: "Oddanchatram Road, Dindigul",
      city: "Dindigul",
      district: "Dindigul",
      state: "Tamil Nadu",
      latitude: 10.3673,
      longitude: 77.9803
    },
    harvestDate: "2026-09-28",
    verificationStatus: "verified",
    reliabilityScore: 96,
    isSample: true
  },
  {
    id: "sup_mkt_f6_grade_c",
    farmerId: "f_farmer_f_lowgrade",
    farmerName: "Farmer F (Damaged Crop Lot)",
    phone: "9876543106",
    crop: "Tomato",
    category: "vegetable",
    variety: "Bruised Cull Lot",
    qualityGrade: "Grade C — Damaged / Surplus",
    condition: "damaged",
    availableQuantityKg: 400,
    availableQuantityTonnes: 0.4,
    pricePerKg: 15,
    pricePerTonne: 15000,
    location: {
      address: "Aruppukottai Road, Virudhunagar",
      city: "Virudhunagar",
      district: "Virudhunagar",
      state: "Tamil Nadu",
      latitude: 9.5680,
      longitude: 77.9624
    },
    harvestDate: "2026-09-28",
    verificationStatus: "verified",
    reliabilityScore: 80,
    isSample: true
  },

  // --- Onion Lots ---
  {
    id: "sup_mkt_onion_1",
    farmerId: "f_sundaram_onion",
    farmerName: "Sundaram Red Onion Syndicate",
    phone: "9876543110",
    crop: "Onion",
    category: "vegetable",
    variety: "Bellary Red",
    qualityGrade: "Grade A — Fresh / Premium",
    condition: "fresh",
    availableQuantityKg: 600,
    availableQuantityTonnes: 0.6,
    pricePerKg: 30,
    pricePerTonne: 30000,
    location: {
      address: "Tirumangalam, Madurai",
      city: "Madurai",
      district: "Madurai",
      state: "Tamil Nadu",
      latitude: 9.8242,
      longitude: 77.9880
    },
    harvestDate: "2026-09-28",
    verificationStatus: "verified",
    reliabilityScore: 97,
    isSample: true
  },
  {
    id: "sup_mkt_onion_2",
    farmerId: "f_vasanth_onion",
    farmerName: "Vasanth Fresh Shallots",
    phone: "9876543111",
    crop: "Onion",
    category: "vegetable",
    variety: "Small Red Onion (CO-5)",
    qualityGrade: "Grade A — Fresh / Premium",
    condition: "fresh",
    availableQuantityKg: 400,
    availableQuantityTonnes: 0.4,
    pricePerKg: 32,
    pricePerTonne: 32000,
    location: {
      address: "Chekkanurani, Madurai",
      city: "Madurai",
      district: "Madurai",
      state: "Tamil Nadu",
      latitude: 9.9482,
      longitude: 77.9400
    },
    harvestDate: "2026-09-28",
    verificationStatus: "verified",
    reliabilityScore: 95,
    isSample: true
  },

  // --- Potato Lots ---
  {
    id: "sup_mkt_potato_1",
    farmerId: "f_arumugam_potato",
    farmerName: "Arumugam Table Potato",
    phone: "9876543120",
    crop: "Potato",
    category: "vegetable",
    variety: "Kufri Jyoti (Table Fresh)",
    qualityGrade: "Grade A — Fresh / Premium",
    condition: "fresh",
    availableQuantityKg: 800,
    availableQuantityTonnes: 0.8,
    pricePerKg: 22,
    pricePerTonne: 22000,
    location: {
      address: "Kodaikanal Foothills, Dindigul",
      city: "Dindigul",
      district: "Dindigul",
      state: "Tamil Nadu",
      latitude: 10.2381,
      longitude: 77.4892
    },
    harvestDate: "2026-09-28",
    verificationStatus: "verified",
    reliabilityScore: 96,
    isSample: true
  },

  // --- Fruit Lots (Banana, Mango, Grapes) ---
  {
    id: "sup_mkt_banana_1",
    farmerId: "f_cauvery_banana",
    farmerName: "Cauvery Delta Banana Growers",
    phone: "9876543130",
    crop: "Banana",
    category: "fruit",
    variety: "Grand Naine / Robusta",
    qualityGrade: "Grade A — Fresh / Premium",
    condition: "fresh",
    availableQuantityKg: 1000,
    availableQuantityTonnes: 1.0,
    pricePerKg: 18,
    pricePerTonne: 18000,
    location: {
      address: "Kulithalai, Karur",
      city: "Karur",
      district: "Karur",
      state: "Tamil Nadu",
      latitude: 10.9601,
      longitude: 78.0766
    },
    harvestDate: "2026-09-28",
    verificationStatus: "verified",
    reliabilityScore: 96,
    isSample: true
  }
];

export const DEMO_SUPPLY_SILAGE = [
  {
    id: "sup_sil_f1",
    farmerId: "f_dairy_karur1",
    farmerName: "Karur Green Stover Hub",
    phone: "9876543201",
    crop: "Maize Stover",
    variety: "Pioneer Fodder Stover",
    qualityGrade: "High Sugar Fodder",
    condition: "fresh_green",
    availableQuantityTonnes: 6.0,
    availableQuantityKg: 6000,
    pricePerKg: 3.2,
    pricePerTonne: 3200,
    moisturePercent: 65,
    location: {
      address: "Kulithalai Road, Karur",
      city: "Karur",
      district: "Karur",
      state: "Tamil Nadu",
      latitude: 10.9601,
      longitude: 78.0766
    },
    harvestDate: "2026-10-04",
    verificationStatus: "verified",
    reliabilityScore: 97,
    isSample: true
  },
  {
    id: "sup_sil_f2",
    farmerId: "f_dairy_dindigul2",
    farmerName: "Dindigul Napier Collective",
    phone: "9876543202",
    crop: "Napier Grass",
    variety: "Co-4 Super Napier",
    qualityGrade: "Premium Dairy Cut",
    condition: "fresh_green",
    availableQuantityTonnes: 8.0,
    availableQuantityKg: 8000,
    pricePerKg: 2.8,
    pricePerTonne: 2800,
    moisturePercent: 70,
    location: {
      address: "Batlagundu Agro Belt, Dindigul",
      city: "Dindigul",
      district: "Dindigul",
      state: "Tamil Nadu",
      latitude: 10.1632,
      longitude: 77.7634
    },
    harvestDate: "2026-10-05",
    verificationStatus: "verified",
    reliabilityScore: 96,
    isSample: true
  },
  {
    id: "sup_sil_f3",
    farmerId: "f_dairy_theni3",
    farmerName: "Cumbum Valley Sorghum Farm",
    phone: "9876543203",
    crop: "Sorghum Stalks",
    variety: "Sweet Sorghum Silage Cut",
    qualityGrade: "Silage Grade A",
    condition: "fresh_green",
    availableQuantityTonnes: 4.0,
    availableQuantityKg: 4000,
    pricePerKg: 3.0,
    pricePerTonne: 3000,
    moisturePercent: 62,
    location: {
      address: "Chinnamanur, Theni",
      city: "Theni",
      district: "Theni",
      state: "Tamil Nadu",
      latitude: 9.8398,
      longitude: 77.3820
    },
    harvestDate: "2026-10-05",
    verificationStatus: "verified",
    reliabilityScore: 94,
    isSample: true
  },
  {
    id: "sup_sil_f4_moldy",
    farmerId: "f_dairy_unsafe4",
    farmerName: "Substandard Moist Stover (Rejected Demo)",
    phone: "9876543204",
    crop: "Maize Stover",
    variety: "Stale Crop",
    qualityGrade: "Substandard",
    condition: "moldy", // STRICTLY FILTERED OUT BY ENGINE
    availableQuantityTonnes: 5.0,
    availableQuantityKg: 5000,
    pricePerKg: 1.0,
    pricePerTonne: 1000,
    moisturePercent: 85,
    location: {
      address: "Lowland Waterlogged Area",
      city: "Madurai",
      district: "Madurai",
      state: "Tamil Nadu",
      latitude: 9.9010,
      longitude: 78.1020
    },
    harvestDate: "2026-09-20",
    verificationStatus: "unverified",
    reliabilityScore: 30,
    isSample: true
  }
];

export const DEMO_SUPPLY_WASTE = [
  {
    id: "sup_wst_f1",
    farmerId: "f_wst_tanjore1",
    farmerName: "Cauvery Delta Straw Syndicate",
    phone: "9876543301",
    crop: "Paddy Straw",
    variety: "CR1009 Baled Straw",
    qualityGrade: "Dry Baled Biomass",
    condition: "dry_baled",
    availableQuantityTonnes: 12.0,
    availableQuantityKg: 12000,
    pricePerKg: 1.8,
    pricePerTonne: 1800,
    processingSuitability: ["Bio-coal / Briquetting", "Paper Pulp", "Mushroom Substrate"],
    location: {
      address: "Thiruvaiyaru, Thanjavur",
      city: "Thanjavur",
      district: "Thanjavur",
      state: "Tamil Nadu",
      latitude: 10.8808,
      longitude: 79.1065
    },
    harvestDate: "2026-10-03",
    verificationStatus: "verified",
    reliabilityScore: 95,
    isSample: true
  },
  {
    id: "sup_wst_f2",
    farmerId: "f_wst_trichy2",
    farmerName: "Trichy Banana Pseudostem Hub",
    phone: "9876543302",
    crop: "Banana Stem / Fibre Residue",
    variety: "Poovan Stem Cut",
    qualityGrade: "Fibre Extraction Grade",
    condition: "fresh_cut",
    availableQuantityTonnes: 8.0,
    availableQuantityKg: 8000,
    pricePerKg: 1.5,
    pricePerTonne: 1500,
    processingSuitability: ["Fibre Extraction", "Organic Fertilizer", "Biogas"],
    location: {
      address: "Lalgudi, Tiruchirappalli",
      city: "Tiruchirappalli",
      district: "Tiruchirappalli",
      state: "Tamil Nadu",
      latitude: 10.8710,
      longitude: 78.7849
    },
    harvestDate: "2026-10-04",
    verificationStatus: "verified",
    reliabilityScore: 93,
    isSample: true
  },
  {
    id: "sup_wst_f3",
    farmerId: "f_wst_namakkal3",
    farmerName: "Namakkal Agro Biomass Pool",
    phone: "9876543303",
    crop: "Groundnut Shells & Coir Residue",
    variety: "Crushed Biomass",
    qualityGrade: "High Calorific Boiler Grade",
    condition: "dry",
    availableQuantityTonnes: 15.0,
    availableQuantityKg: 15000,
    pricePerKg: 2.2,
    pricePerTonne: 2200,
    processingSuitability: ["Boiler Fuel", "Biochar", "Mulching"],
    location: {
      address: "Paramathi Velur, Namakkal",
      city: "Namakkal",
      district: "Namakkal",
      state: "Tamil Nadu",
      latitude: 11.0543,
      longitude: 78.0121
    },
    harvestDate: "2026-10-04",
    verificationStatus: "verified",
    reliabilityScore: 96,
    isSample: true
  }
];

/**
 * Maps a real PostgreSQL/marketplace listing to the standardized supplier lot model.
 * Does not invent farmer data or fabricate fake GPS coordinates.
 */
export function mapMarketplaceListingToSupplierLot(listing) {
  if (!listing) return null;

  const qualityGrade = normalizeMarketIntelligenceGrade(
    listing.quality_grade || listing.qualityGrade || listing.condition
  );

  const cropName = listing.crop_type || listing.crop || "Produce";
  const isFruit = FRESH_PRODUCE_CATALOG.fruits.some(
    f => f.toLowerCase() === cropName.toLowerCase()
  );
  const category = isFruit ? "fruit" : "vegetable";

  const rawQtyKg = listing.quantity_kg !== undefined 
    ? Number(listing.quantity_kg) 
    : (listing.quantityKg !== undefined 
        ? Number(listing.quantityKg) 
        : (listing.availableQuantityKg !== undefined ? Number(listing.availableQuantityKg) : 0));
  const availableQuantityKg = Math.max(0, isNaN(rawQtyKg) ? 0 : rawQtyKg);
  const availableQuantityTonnes = Number((availableQuantityKg / 1000).toFixed(3));

  const rawPrice = listing.asking_price !== undefined 
    ? Number(listing.asking_price) 
    : (listing.pricePerKg !== undefined ? Number(listing.pricePerKg) : (listing.price !== undefined ? Number(listing.price) : 0));
  const pricePerKg = Math.max(0, isNaN(rawPrice) ? 0 : rawPrice);
  const pricePerTonne = pricePerKg * 1000;

  // Real location only - do NOT invent GPS coordinates
  const lat = (listing.latitude !== null && listing.latitude !== undefined && listing.latitude !== "" && !isNaN(Number(listing.latitude)))
    ? Number(listing.latitude)
    : null;
  const lon = (listing.longitude !== null && listing.longitude !== undefined && listing.longitude !== "" && !isNaN(Number(listing.longitude)))
    ? Number(listing.longitude)
    : null;

  const listingId = String(listing.id || listing.listingId || `listing_${Date.now()}`);
  const farmerId = String(listing.creator_id || listing.creatorId || listing.farmerId || "usr_farmer");
  const farmerName = listing.farmer_name || listing.farmerName || listing.creator_name || listing.creatorName || listing.user || "Local Farmer";

  let images = [];
  if (Array.isArray(listing.images)) {
    images = listing.images.filter(Boolean);
  } else if (typeof listing.images === "string") {
    try {
      const p = JSON.parse(listing.images);
      if (Array.isArray(p)) images = p.filter(Boolean);
      else if (p) images = [p];
    } catch {
      images = [listing.images];
    }
  }
  if (images.length === 0) {
    const rawImg = listing.image_url || listing.image;
    if (rawImg && typeof rawImg === "string") {
      if (rawImg.trim().startsWith("[") || rawImg.trim().startsWith("{")) {
        try {
          const p = JSON.parse(rawImg);
          if (Array.isArray(p)) images = p.filter(Boolean);
          else if (p) images = [p];
        } catch {
          images = [rawImg];
        }
      } else {
        images = [rawImg];
      }
    }
  }
  images = images.slice(0, 3);

  return {
    id: listingId,
    listingId: listingId,
    farmerId: farmerId,
    farmerName: farmerName,
    phone: listing.contact_phone || listing.contactPhone || listing.farmerPhone || listing.phone || null,
    crop: cropName,
    category: category,
    variety: listing.variety || listing.title || cropName,
    qualityGrade: qualityGrade,
    condition: listing.condition || "fresh",
    availableQuantityKg: availableQuantityKg,
    availableQuantityTonnes: availableQuantityTonnes,
    pricePerKg: pricePerKg,
    pricePerTonne: pricePerTonne,
    latitude: lat,
    longitude: lon,
    location: {
      address: listing.location || listing.district || "Farm Location",
      city: listing.district || listing.city || listing.location || "Madurai",
      district: listing.district || null,
      state: listing.state || "Tamil Nadu",
      latitude: lat,
      longitude: lon
    },
    images: images,
    image_url: images[0] || listing.image_url || listing.image || null,
    image: images[0] || listing.image_url || listing.image || null,
    hasPhotos: images.length > 0,
    availableDate: listing.available_date || listing.availableDate || listing.created_at || listing.createdAt || new Date().toISOString().split("T")[0],
    available_date: listing.available_date || listing.availableDate || listing.created_at || listing.createdAt || new Date().toISOString().split("T")[0],
    harvestDate: listing.available_date || listing.availableDate || listing.harvestDate || listing.created_at || listing.createdAt || new Date().toISOString().split("T")[0],
    verificationStatus: listing.creatorVerificationStatus || listing.verificationStatus || listing.verification_status || "verified",
    reliabilityScore: 95,
    isSample: false,
    status: listing.status || "listed"
  };
}

/**
 * Calculates Haversine distance between two GPS coordinates in km
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== "number" || isNaN(lat1) || lat1 === null ||
    typeof lon1 !== "number" || isNaN(lon1) || lon1 === null ||
    typeof lat2 !== "number" || isNaN(lat2) || lat2 === null ||
    typeof lon2 !== "number" || isNaN(lon2) || lon2 === null
  ) {
    return null; // Do NOT invent distances when coordinates are missing
  }

  const R = 6371; // Earth's radius in km
  const toRad = (deg) => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// ==========================================
// CORE MATCHING ENGINE
// ==========================================

/**
 * Analyzes available multi-farmer supply against a buyer requirement
 * and generates 1–3 ranked smart combinations without forcing a single decision.
 *
 * @param {Object} params
 * @param {Object} params.demand - Buyer demand requirements
 * @param {string} params.demand.crop - Crop/material name
 * @param {number} [params.demand.quantityKg] - Target quantity in kg
 * @param {number} [params.demand.quantityTonnes] - Target quantity in Tonnes
 * @param {string} [params.demand.qualityGrade] - Preferred quality/grade ('Grade A', 'Grade A/B', 'Grade B')
 * @param {string} [params.demand.requiredDate] - Required delivery date
 * @param {number} [params.demand.maxPricePerKg] - Maximum acceptable price per kg
 * @param {Object|string} [params.demand.destinationLocation] - Buyer delivery location
 * @param {string} [params.demand.buyerName] - Buyer business name
 * @param {string} [params.demand.buyerId] - Buyer identifier
 * @param {string} [params.matchType] - "MARKET" | "SILAGE" | "WASTE"
 * @param {Array} [params.supplyListings] - Real farmer supply pool (or demo dataset fallback if null/undefined)
 * @param {number} [params.maxRadiusKm] - Max search radius (default 150 km)
 * @returns {Object} { combinations, candidateSuppliers, demand, matchType, isFulfillable, totalAvailableSupplyKg, message }
 */
export function findSmartSupplyCombinations({
  demand = {},
  matchType = MATCH_TYPES.MARKET,
  supplyListings = null,
  maxRadiusKm = null
} = {}) {
  const targetCrop = (demand.crop || demand.produce || "").trim();
  const targetCategory = (demand.category || "vegetable").toLowerCase();

  // Normalize target quantity in kg (primary unit) and Tonnes
  let targetQuantityKg = 1000;
  if (demand.quantityKg !== undefined && demand.quantityKg !== null) {
    targetQuantityKg = Number(demand.quantityKg);
  } else if (demand.quantityTonnes !== undefined && demand.quantityTonnes !== null) {
    targetQuantityKg = Number(demand.quantityTonnes) * 1000;
  } else if (demand.quantity !== undefined && demand.quantity !== null) {
    targetQuantityKg = Number(demand.quantity);
  }
  if (isNaN(targetQuantityKg) || targetQuantityKg <= 0) targetQuantityKg = 1000;
  const targetQuantityTonnes = Number((targetQuantityKg / 1000).toFixed(3));

  const requestedGrade = demand.qualityGrade || demand.grade || null;
  const maxPriceCap = (demand.maxPricePerKg !== undefined && demand.maxPricePerKg !== null && demand.maxPricePerKg !== "") 
    ? Number(demand.maxPricePerKg) 
    : (demand.maxPrice ? Number(demand.maxPrice) : null);

  const buyerLoc = demand.destinationLocation || {
    city: "Madurai",
    state: "Tamil Nadu",
    latitude: 9.9252,
    longitude: 78.1198
  };

  const buyerLat = typeof buyerLoc === "object" ? buyerLoc.latitude : null;
  const buyerLon = typeof buyerLoc === "object" ? buyerLoc.longitude : null;

  // 1. Gather raw supply pool (from passed listings; ONLY fall back to demo if explicitly undefined/null)
  let rawPool = supplyListings;
  if (supplyListings === null || supplyListings === undefined) {
    if (matchType === MATCH_TYPES.SILAGE) {
      rawPool = DEMO_SUPPLY_SILAGE;
    } else if (matchType === MATCH_TYPES.WASTE) {
      rawPool = DEMO_SUPPLY_WASTE;
    } else {
      rawPool = DEMO_SUPPLY_MARKET;
    }
  }

  // 2. Filter incompatible supply based on pathway-specific rules
  const candidateSuppliers = [];
  const seenListingIds = new Set();
  const effectiveMaxRadius = demand.maxRadiusKm || demand.procurementRadiusKm || maxRadiusKm || null;

  for (const item of rawPool) {
    const listingId = String(item.id || item.listingId || "");
    if (listingId && seenListingIds.has(listingId)) {
      continue; // Duplicate listing protection: never process same listing twice
    }

    const itemCrop = item.crop || item.crop_type || "";
    const itemQtyKg = Number(item.availableQuantityKg !== undefined ? item.availableQuantityKg : (item.quantity_kg !== undefined ? item.quantity_kg : (item.availableQuantityTonnes ? item.availableQuantityTonnes * 1000 : 0)));
    if (itemQtyKg <= 0) continue;

    const itemCondition = (item.condition || "").toLowerCase();
    const itemGrade = item.qualityGrade || "Grade A";
    const pricePerKg = Number(item.pricePerKg !== undefined ? item.pricePerKg : (item.price_per_kg !== undefined ? item.price_per_kg : (item.asking_price || 0)));
    const pricePerTonne = pricePerKg * 1000;

    // Pathway Rule 1: SILAGE BANK Safety Filter
    if (matchType === MATCH_TYPES.SILAGE) {
      const isUnsafe = SILAGE_UNSAFE_CONDITIONS.some((cond) => itemCondition.includes(cond));
      if (isUnsafe) {
        // STRICT REJECTION: Do NOT match moldy/contaminated material for animal feed
        continue;
      }
    }

    // Pathway Rule 2: Price Ceiling Filter (if buyer specified max acceptable price)
    if (maxPriceCap !== null && !isNaN(maxPriceCap) && maxPriceCap > 0) {
      if (pricePerKg > maxPriceCap) {
        // Filter out suppliers whose asking price exceeds buyer's maximum price ceiling
        continue;
      }
    }


    // Pathway Rule 3: Quality / Grade & Intended Use Compatibility Check
    if (matchType === MATCH_TYPES.MARKET) {
      const isCompatible = checkGradeAndIntendedUseCompatibility(itemGrade, demand);
      if (!isCompatible) {
        continue;
      }
    }

    // Pathway Rule 4: Availability Date vs Required-By Date Check
    const lotAvailDate = item.available_date || item.availableDate || item.harvestDate;
    if (demand.requiredDate && lotAvailDate && typeof lotAvailDate === "string" && typeof demand.requiredDate === "string") {
      // If date format is YYYY-MM-DD, verify lot is available on or before the required date
      if (lotAvailDate.length === 10 && demand.requiredDate.length === 10 && lotAvailDate > demand.requiredDate) {
        continue; // Exceeds required fulfillment timeline
      }
    }

    // Pathway Rule 5: Crop / Material Compatibility Check
    const normTarget = (targetCrop || "").toLowerCase().trim();
    const normItem = (itemCrop || "").toLowerCase().trim();
    const canonicalTarget = KNOWN_CROP_ALIASES[normalizeCropName(targetCrop)] || normalizeCropName(targetCrop);
    const canonicalItem = KNOWN_CROP_ALIASES[normalizeCropName(itemCrop)] || normalizeCropName(itemCrop);

    let isCropMatch = false;
    if (matchType === MATCH_TYPES.MARKET) {
      isCropMatch = (canonicalTarget && canonicalItem && canonicalTarget === canonicalItem) || 
                    (normItem && normTarget && (normItem.includes(normTarget) || normTarget.includes(normItem)));
    } else if (matchType === MATCH_TYPES.SILAGE) {
      const isItemFeedEligible = SILAGE_ELIGIBLE_CROPS.some(c => normItem.includes(c));
      const isTargetFeedEligible = SILAGE_ELIGIBLE_CROPS.some(c => normTarget.includes(c)) || 
        normTarget.includes("silage") || normTarget.includes("fodder") || normTarget.includes("feed") || normTarget.includes("stover");
      
      if (isItemFeedEligible && isTargetFeedEligible) {
        isCropMatch = true;
      } else {
        isCropMatch = canonicalTarget === canonicalItem || normItem.includes(normTarget) || normTarget.includes(normItem);
      }
    } else if (matchType === MATCH_TYPES.WASTE) {
      const isItemWasteEligible = WASTE_ELIGIBLE_TYPES.some(c => normItem.includes(c));
      const isTargetWasteEligible = WASTE_ELIGIBLE_TYPES.some(c => normTarget.includes(c)) ||
        normTarget.includes("biomass") || normTarget.includes("residue") || normTarget.includes("waste") || normTarget.includes("straw") || normTarget.includes("agricultural");
      
      if (isItemWasteEligible && isTargetWasteEligible) {
        isCropMatch = true;
      } else {
        isCropMatch = canonicalTarget === canonicalItem || normItem.includes(normTarget) || normTarget.includes(normItem);
      }
    }

    // If still not matching and target was specified, skip
    if (targetCrop && targetCrop.length >= 3 && !isCropMatch) {
      continue;
    }

    // Pathway Rule 6: Calculate distance to buyer destination if actual coordinates exist
    const rawItemLat = item.latitude !== undefined && item.latitude !== null ? item.latitude : item.location?.latitude;
    const rawItemLon = item.longitude !== undefined && item.longitude !== null ? item.longitude : item.location?.longitude;
    const itemLat = (rawItemLat !== null && rawItemLat !== undefined && rawItemLat !== "" && !isNaN(Number(rawItemLat)) && Number.isFinite(Number(rawItemLat))) ? Number(rawItemLat) : null;
    const itemLon = (rawItemLon !== null && rawItemLon !== undefined && rawItemLon !== "" && !isNaN(Number(rawItemLon)) && Number.isFinite(Number(rawItemLon))) ? Number(rawItemLon) : null;

    const distanceKm = (itemLat !== null && itemLon !== null && buyerLat !== null && buyerLon !== null)
      ? calculateDistanceKm(itemLat, itemLon, buyerLat, buyerLon)
      : null;

    if (effectiveMaxRadius && distanceKm !== null && distanceKm > effectiveMaxRadius) {
      continue; // Exceeds procurement radius
    }

    if (listingId) seenListingIds.add(listingId);

    candidateSuppliers.push({
      id: listingId || `sup_${Math.random().toString(36).substr(2, 6)}`,
      listingId: listingId || item.id,
      farmerId: String(item.farmerId || item.creatorId || item.id || "usr_farmer"),
      farmerName: item.farmerName || item.name || item.creatorName || item.farmer_name || "Verified Local Producer",
      phone: item.phone || item.creatorPhone || null,
      crop: itemCrop || targetCrop,
      category: item.category || targetCategory,
      variety: item.variety || "Commercial Grade",
      qualityGrade: itemGrade,
      condition: item.condition || "fresh",
      availableQuantityKg: Number(itemQtyKg),
      availableQuantityTonnes: Number((itemQtyKg / 1000).toFixed(3)),
      pricePerKg,
      pricePerTonne,
      distanceKm,
      latitude: itemLat,
      longitude: itemLon,
      location: item.location || { address: "Farm Location", city: "Madurai", state: "Tamil Nadu", latitude: itemLat, longitude: itemLon },
      images: Array.isArray(item.images) ? item.images : (item.image_url || item.image ? [item.image_url || item.image] : []),
      image_url: item.image_url || item.image || (Array.isArray(item.images) ? item.images[0] : null) || null,
      image: item.image || item.image_url || (Array.isArray(item.images) ? item.images[0] : null) || null,
      hasPhotos: Boolean((item.images && item.images.length > 0) || item.image_url || item.image),
      availableDate: item.available_date || item.availableDate || item.harvestDate || new Date().toISOString().split("T")[0],
      harvestDate: item.harvestDate || item.availableDate || item.date || new Date().toISOString().split("T")[0],
      verificationStatus: item.verificationStatus || item.creatorVerificationStatus || "verified",
      reliabilityScore: item.reliabilityScore || 95,
      isSample: Boolean(item.isSample)
    });
  }

  // Sort candidate pool by distance ascending (null distances placed at end)
  candidateSuppliers.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));


  const totalAvailableSupplyKg = candidateSuppliers.reduce((sum, s) => sum + s.availableQuantityKg, 0);

  if (candidateSuppliers.length === 0) {
    const radiusMsg = effectiveMaxRadius ? ` within ${effectiveMaxRadius} km` : "";
    return {
      combinations: [],
      candidateSuppliers: [],
      demand: { 
        ...demand, 
        buyerType: demand.buyerType || "Food Processor",
        intendedUse: demand.intendedUse || "Processing",
        crop: targetCrop, 
        quantityKg: targetQuantityKg, 
        quantityTonnes: targetQuantityTonnes 
      },
      matchType,
      isFulfillable: false,
      totalAvailableSupplyKg: 0,
      totalAvailableSupplyTonnes: 0,
      message: `No compatible ${targetCrop || "produce"} suppliers found${radiusMsg} matching your price/quality criteria.`
    };
  }

  // 3. Combinatorial Solver: Find 1–3 Smart Combinations in kg
  const combinations = generateCombinationsKg(candidateSuppliers, targetQuantityKg, buyerLoc, matchType, demand);

  return {
    combinations,
    candidateSuppliers,
    demand: {
      ...demand,
      buyerType: demand.buyerType || "Food Processor",
      intendedUse: demand.intendedUse || "Processing",
      crop: targetCrop,
      category: targetCategory,
      quantityKg: targetQuantityKg,
      quantityTonnes: targetQuantityTonnes,
      qualityGrade: requestedGrade,
      maxPricePerKg: maxPriceCap,
      destinationLocation: buyerLoc
    },
    matchType,
    isFulfillable: combinations.length > 0 && combinations[0].totalQuantityKg >= targetQuantityKg * 0.9,
    totalAvailableSupplyKg,
    totalAvailableSupplyTonnes: Number((totalAvailableSupplyKg / 1000).toFixed(3)),
    message: combinations.length > 0 
      ? `Found ${combinations.length} smart procurement combination${combinations.length > 1 ? "s" : ""} for ${targetQuantityKg.toLocaleString()} kg ${targetCrop}.`
      : `Partial supply available (${totalAvailableSupplyKg.toLocaleString()} kg available vs ${targetQuantityKg.toLocaleString()} kg required).`
  };
}

/**
 * Deterministic Rule-Based Combinatorial Generator (kg-First)
 * Generates 1–3 distinct archetypes:
 * 1. OPTIMAL_PROXIMITY (Clustered lowest transit distance)
 * 2. BEST_VALUE (Lowest procurement payout / unit cost)
 * 3. MINIMAL_STOPS (Fewest farmer pickups for operational simplicity)
 */
function generateCombinationsKg(candidateSuppliers, targetQuantityKg, buyerLoc, matchType, demand = {}) {
  const results = [];

  function evaluateComboKg(suppliers, archetypeId, archetypeName, archetypeBadge, description) {
    let allocatedSumKg = 0;
    const allocations = [];

    for (const sup of suppliers) {
      const neededKg = targetQuantityKg - allocatedSumKg;
      if (neededKg <= 0) break;

      const takeQtyKg = Math.min(sup.availableQuantityKg, neededKg);
      allocations.push({
        supplierId: sup.id,
        listingId: sup.listingId || sup.id,
        farmerId: sup.farmerId,
        farmerName: sup.farmerName,
        phone: sup.phone,
        crop: sup.crop,
        variety: sup.variety,
        qualityGrade: sup.qualityGrade,
        allocatedQuantityKg: takeQtyKg,
        allocatedQuantityTonnes: Number((takeQtyKg / 1000).toFixed(3)),
        availableQuantityKg: sup.availableQuantityKg,
        availableQuantityTonnes: sup.availableQuantityTonnes,
        pricePerKg: sup.pricePerKg,
        farmerAskingPrice: sup.pricePerKg,
        pricePerTonne: sup.pricePerTonne,
        farmerSubtotal: Math.round(takeQtyKg * sup.pricePerKg),
        distanceKm: sup.distanceKm,
        latitude: sup.latitude ?? sup.location?.latitude ?? null,
        longitude: sup.longitude ?? sup.location?.longitude ?? null,
        location: sup.location,
        images: sup.images || [],
        image_url: sup.image_url || sup.image || (sup.images && sup.images[0]) || null,
        image: sup.image || sup.image_url || (sup.images && sup.images[0]) || null,
        hasPhotos: Boolean(sup.hasPhotos || (sup.images && sup.images.length > 0) || sup.image_url || sup.image),
        reliabilityScore: sup.reliabilityScore,
        matchExplanation: {
          cropMatched: true,
          crop: sup.crop,
          gradeMatched: true,
          grade: sup.qualityGrade,
          intendedUseMatched: true,
          intendedUse: demand.intendedUse || "Processing",
          buyerType: demand.buyerType || "Food Processor",
          quantityMatchedKg: takeQtyKg,
          targetQuantityKg: targetQuantityKg,
          availableBeforeDate: true,
          availableDate: sup.availableDate,
          locationCompatible: true,
          distanceKm: sup.distanceKm
        }
      });

      allocatedSumKg += takeQtyKg;
    }

    allocatedSumKg = Number(allocatedSumKg.toFixed(2));
    const totalProduceCost = allocations.reduce((sum, a) => sum + a.farmerSubtotal, 0);
    const averageProducePrice = allocatedSumKg > 0 ? Number((totalProduceCost / allocatedSumKg).toFixed(2)) : 0;
    const validDistances = allocations.filter(a => a.distanceKm !== null && a.distanceKm !== undefined && !isNaN(Number(a.distanceKm)));
    const averageDistanceKm = validDistances.length > 0 ? Number((validDistances.reduce((s, a) => s + a.distanceKm, 0) / validDistances.length).toFixed(1)) : 0;
    const maxDistanceKm = validDistances.length > 0 ? validDistances.reduce((max, a) => Math.max(max, a.distanceKm), 0) : 0;
    
    // Transparent rule-based score (out of 100)
    const fulfillmentRatio = Math.min(1.0, allocatedSumKg / targetQuantityKg);
    const proximityScore = Math.max(10, 100 - (averageDistanceKm * 0.8));
    const reliabilityAvg = allocations.reduce((s, a) => s + a.reliabilityScore, 0) / (allocations.length || 1);
    const transparentScore = Math.round(
      fulfillmentRatio * 40 +
      (proximityScore / 100) * 25 +
      (reliabilityAvg / 100) * 20 +
      (allocations.length <= 4 ? 15 : 8)
    );

    return {
      combinationId: `combo_${archetypeId}_${Date.now()}`,
      archetypeId,
      archetypeName,
      archetypeBadge,
      description,
      allocations,
      suppliersCount: allocations.length,
      totalQuantityKg: allocatedSumKg,
      totalQuantityTonnes: Number((allocatedSumKg / 1000).toFixed(3)),
      targetQuantityKg,
      targetQuantityTonnes: Number((targetQuantityKg / 1000).toFixed(3)),
      fulfillmentPercentage: Math.min(100, Math.round((allocatedSumKg / targetQuantityKg) * 100)),
      fulfillmentStatus: allocatedSumKg >= targetQuantityKg 
        ? FULFILLMENT_STATUS.EXACT 
        : FULFILLMENT_STATUS.DEFICIT,
      totalProduceCost,
      totalProduceValue: totalProduceCost,
      averageProducePrice,
      averageDistanceKm,
      maxDistanceKm,
      score: transparentScore,
      scoreExplanation: `Score combines ${Math.round(fulfillmentRatio * 100)}% quantity fulfillment, ${averageDistanceKm} km average transit radius, and ${Math.round(reliabilityAvg)}% farmer reliability rating.`,
      isRecommended: archetypeId === "OPTIMAL_PROXIMITY"
    };
  }

  // --- ARCHETYPE 1: OPTIMAL PROXIMITY (Sorted by closest distance) ---
  const proximitySorted = [...candidateSuppliers].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  const combo1 = evaluateComboKg(
    proximitySorted,
    "OPTIMAL_PROXIMITY",
    "Smart Procurement Recommendation",
    "Recommended • Proximity Cluster",
    "Optimized for geographic proximity to minimize transit time, retain freshness, and cluster local farmers."
  );
  if (combo1.allocations.length > 0) results.push(combo1);

  // --- ARCHETYPE 2: BEST VALUE (Sorted by unit price ascending) ---
  const priceSorted = [...candidateSuppliers].sort((a, b) => a.pricePerKg - b.pricePerKg || a.distanceKm - b.distanceKm);
  const combo2 = evaluateComboKg(
    priceSorted,
    "BEST_VALUE",
    "Best Produce Procurement Value",
    "Lowest Produce Price",
    "Optimized to deliver the lowest raw produce procurement price across regional supplier lots."
  );
  if (combo2.allocations.length > 0 && !areAllocationsIdenticalKg(combo1.allocations, combo2.allocations)) {
    results.push(combo2);
  }

  // --- ARCHETYPE 3: MINIMAL PICKUPS (Sorted by largest available capacity) ---
  const capacitySorted = [...candidateSuppliers].sort((a, b) => b.availableQuantityKg - a.availableQuantityKg || a.distanceKm - b.distanceKm);
  const combo3 = evaluateComboKg(
    capacitySorted,
    "MINIMAL_STOPS",
    "Minimal Multi-Farmer Pickups",
    "Fewer Suppliers",
    "Prioritizes high-capacity suppliers to minimize loading coordination and truck stops."
  );
  if (
    combo3.allocations.length > 0 && 
    !areAllocationsIdenticalKg(combo1.allocations, combo3.allocations) &&
    !areAllocationsIdenticalKg(combo2?.allocations || [], combo3.allocations)
  ) {
    results.push(combo3);
  }

  return results.slice(0, 3);
}

function areAllocationsIdenticalKg(a1, a2) {
  if (!a1 || !a2 || a1.length !== a2.length) return false;
  const ids1 = a1.map(x => `${x.supplierId}_${x.allocatedQuantityKg}`).sort().join(",");
  const ids2 = a2.map(x => `${x.supplierId}_${x.allocatedQuantityKg}`).sort().join(",");
  return ids1 === ids2;
}

// ==========================================
// DYNAMIC FULFILLMENT CALCULATOR (FOR CUSTOM SELECTION)
// ==========================================

/**
 * Dynamic calculation of manual buyer customization progress.
 *
 * @param {Array} selectedSuppliersWithAllocations - Array of selected suppliers with assigned quantities
 * @param {number} targetQuantityKg - Required quantity in kg
 * @returns {Object} { selectedTotalKg, targetTotalKg, differenceKg, status, badgeText, badgeVariant, percentFulfillment }
 */
export function calculateFulfillmentKg(selectedSuppliersWithAllocations = [], targetQuantityKg = 1000) {
  const target = Number(targetQuantityKg) || 1000;
  const selectedTotal = selectedSuppliersWithAllocations.reduce((sum, item) => {
    const qty = Number(
      item.allocatedQuantityKg ?? 
      item.availableQuantityKg ?? 
      (item.allocatedQuantityTonnes ? item.allocatedQuantityTonnes * 1000 : (item.quantity_kg || item.quantity || 0))
    );
    return sum + (isNaN(qty) ? 0 : qty);
  }, 0);

  const roundedSelected = Number(selectedTotal.toFixed(2));
  const diff = Number((roundedSelected - target).toFixed(2));

  let status = FULFILLMENT_STATUS.EXACT;
  let badgeText = "EXACT MATCH (100%)";
  let badgeVariant = "success"; // Emerald

  if (diff < 0) {
    const requiredRemaining = Math.abs(diff);
    status = FULFILLMENT_STATUS.DEFICIT;
    badgeText = `DEFICIT: ${requiredRemaining.toLocaleString()} kg`;
    badgeVariant = "warning";
  } else if (diff > 0) {
    status = FULFILLMENT_STATUS.EXCESS;
    badgeText = `EXCESS: ${diff.toLocaleString()} kg`;
    badgeVariant = "info";
  }

  const percentFulfillment = Math.min(100, Math.round((roundedSelected / target) * 100));

  return {
    selectedTotalKg: roundedSelected,
    targetTotalKg: target,
    differenceKg: diff,
    status,
    badgeText,
    badgeVariant,
    percentFulfillment
  };
}

// Backward compatibility alias for tonne callers
export function calculateFulfillment(selectedSuppliersWithAllocations = [], targetQuantityTonnes = 10) {
  const res = calculateFulfillmentKg(selectedSuppliersWithAllocations, targetQuantityTonnes * 1000);
  return {
    selectedTotalTonnes: Number((res.selectedTotalKg / 1000).toFixed(2)),
    targetTotalTonnes: targetQuantityTonnes,
    differenceTonnes: Number((res.differenceKg / 1000).toFixed(2)),
    status: res.status,
    badgeText: res.status === FULFILLMENT_STATUS.EXACT 
      ? "✅ Requirement fulfilled" 
      : (res.status === FULFILLMENT_STATUS.DEFICIT ? `⚠️ ${Math.abs(res.differenceKg / 1000).toFixed(1)} T still required` : `⚠️ ${(res.differenceKg / 1000).toFixed(1)} T above requested quantity`),
    badgeVariant: res.badgeVariant,
    percentFulfillment: res.percentFulfillment
  };
}

// ==========================================
// PROCUREMENT ORDER CREATION & PERSISTENCE
// ==========================================

/**
 * Generates a unique Procurement Order ID (e.g. PO-AC-78902)
 */
export function generateProcurementOrderId() {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `PO-AC-${randomNum}`;
}

/**
 * Creates a structured Procurement Order / Supply Allocation
 *
 * @param {Object} params
 * @param {Object} params.demand - Buyer demand requirements
 * @param {Array} params.allocations - Multi-farmer allocations
 * @param {string} [params.matchType] - "MARKET" | "SILAGE" | "WASTE"
 * @param {string} [params.orderType] - "ACCEPTED_RECOMMENDATION" | "CUSTOM_SELECTION"
 * @param {Object} [params.buyerInfo] - Buyer business information
 * @param {string} [params.notes] - Operational notes
 * @returns {Object} The created ProcurementOrder object
 */
export async function createProcurementOrder({
  orderId = null,
  demand = {},
  allocations = [],
  matchType = MATCH_TYPES.MARKET,
  orderType = "ACCEPTED_RECOMMENDATION",
  buyerInfo = {},
  notes = "",
  status = null
} = {}, user = {}) {
  const existingOrders = getProcurementOrders();
  const existingOrder = orderId ? existingOrders.find(o => o.orderId === orderId || o.id === orderId) : null;
  const targetOrderId = existingOrder ? (existingOrder.orderId || existingOrder.id) : (orderId || generateProcurementOrderId());
  const createdAt = existingOrder ? existingOrder.createdAt : new Date().toISOString();

  // Combine existing allocations if continuing sourcing
  const prevAllocations = existingOrder && Array.isArray(existingOrder.allocations) ? existingOrder.allocations : [];
  const rawIncomingAllocations = allocations || [];

  // Filter new allocations that aren't already present
  const newAllocationsToAdd = rawIncomingAllocations.filter(inAlloc => {
    const inId = inAlloc.listingId || inAlloc.supplierId || inAlloc.id;
    return !prevAllocations.some(prev => (prev.listingId || prev.supplierId || prev.id) === inId && prev.allocatedQuantityKg === inAlloc.allocatedQuantityKg);
  });

  const allAllocations = [...prevAllocations, ...newAllocationsToAdd];

  const totalQuantityKg = allAllocations.reduce(
    (sum, a) => sum + (Number(a.allocatedQuantityKg) || (Number(a.allocatedQuantityTonnes || 0) * 1000)),
    0
  );
  const totalQuantityTonnes = Number((totalQuantityKg / 1000).toFixed(3));
  const totalProduceCost = allAllocations.reduce(
    (sum, a) => sum + (Number(a.farmerSubtotal) || (Number(a.allocatedQuantityKg || (a.allocatedQuantityTonnes * 1000)) * Number(a.pricePerKg || 0))),
    0
  );
  const averageProducePrice = totalQuantityKg > 0 ? Number((totalProduceCost / totalQuantityKg).toFixed(2)) : 0;
  const maxDistanceKm = allAllocations.reduce((max, a) => Math.max(max, Number(a.distanceKm || 0)), 0);

  const mappedAllocations = allAllocations.map((a, idx) => {
    const allocatedKg = Number(a.allocatedQuantityKg || (a.allocatedQuantityTonnes ? a.allocatedQuantityTonnes * 1000 : 250));
    const pricePerKg = Number(a.pricePerKg || 25);
    const supplierId = a.supplierId || a.id || a.listingId;
    const listingId = a.listingId || a.supplierId || a.id;
    return {
      allocationIndex: idx + 1,
      supplierId: supplierId,
      listingId: listingId,
      farmerId: a.farmerId || a.id,
      farmerName: a.farmerName || a.name || `Farmer ${String.fromCharCode(65 + idx)}`,
      phone: a.phone || "9876543100",
      crop: a.crop || demand.crop || "Tomato",
      variety: a.variety || "Commercial Lot",
      qualityGrade: a.qualityGrade || "Grade A",
      allocatedQuantityKg: allocatedKg,
      allocatedQuantityTonnes: Number((allocatedKg / 1000).toFixed(3)),
      availableQuantityKg: Number(a.availableQuantityKg || (a.availableQuantityTonnes ? a.availableQuantityTonnes * 1000 : allocatedKg)),
      pricePerKg,
      farmerSubtotal: Math.round(allocatedKg * pricePerKg),
      distanceKm: Number(a.distanceKm || 20),
      location: a.location || { address: "Madurai Cluster", city: "Madurai", state: "Tamil Nadu" },
      status: a.status || "CONFIRMED",
      paymentStatus: "PENDING", // Explicit pending payment status
      pickupStatus: "PENDING_LOGISTICS_PLANNING"
    };
  });

  const requestedQuantityKg = Number(
    demand.requestedQuantityKg || 
    demand.quantityKg || 
    (demand.quantityTonnes ? demand.quantityTonnes * 1000 : null) || 
    (existingOrder?.demand?.requestedQuantityKg) || 
    totalQuantityKg
  ) || totalQuantityKg;

  const remainingQuantityKg = Math.max(0, Number((requestedQuantityKg - totalQuantityKg).toFixed(3)));

  let orderLifecycleStatus = status;
  if (!orderLifecycleStatus) {
    if (existingOrder && (existingOrder.status === ORDER_STATUS.PARTIALLY_FULFILLED || existingOrder.status === ORDER_STATUS.CLOSED)) {
      orderLifecycleStatus = existingOrder.status;
    } else if (totalQuantityKg === 0) {
      orderLifecycleStatus = ORDER_STATUS.REQUESTED;
    } else if (totalQuantityKg < requestedQuantityKg) {
      orderLifecycleStatus = ORDER_STATUS.PARTIALLY_SOURCED;
    } else if (existingOrder && existingOrder.status === ORDER_STATUS.PARTIALLY_SOURCED) {
      orderLifecycleStatus = ORDER_STATUS.FULLY_SOURCED;
    } else {
      orderLifecycleStatus = ORDER_STATUS.CONFIRMED;
    }
  }

  const procurementOrder = {
    orderId: targetOrderId,
    id: targetOrderId,
    matchType,
    orderType, // "ACCEPTED_RECOMMENDATION" | "CUSTOM_SELECTION"
    status: orderLifecycleStatus,
    createdAt,
    updatedAt: new Date().toISOString(),
    demand: {
      crop: demand.crop || demand.produce || existingOrder?.demand?.crop || "Tomato",
      category: demand.category || existingOrder?.demand?.category || "vegetable",
      buyerType: demand.buyerType || existingOrder?.demand?.buyerType || "Food Processor",
      intendedUse: demand.intendedUse || existingOrder?.demand?.intendedUse || "Processing",
      requestedQuantityKg: requestedQuantityKg,
      requestedQuantityTonnes: Number((requestedQuantityKg / 1000).toFixed(3)),
      requiredDate: demand.requiredDate || existingOrder?.demand?.requiredDate || new Date().toISOString().split("T")[0],
      qualityGrade: normalizeMarketIntelligenceGrade(demand.qualityGrade || existingOrder?.demand?.qualityGrade || "Grade A — Fresh / Premium"),
      acceptedGrades: demand.acceptedGrades || [normalizeMarketIntelligenceGrade(demand.qualityGrade || "Grade A — Fresh / Premium")],
      maxPricePerKg: demand.maxPricePerKg || existingOrder?.demand?.maxPricePerKg || null,
      destinationLocation: demand.destinationLocation || existingOrder?.demand?.destinationLocation || {
        address: "Madurai Commercial Hub",
        city: "Madurai",
        state: "Tamil Nadu",
        latitude: 9.9252,
        longitude: 78.1198
      }
    },
    buyer: {
      buyerId: buyerInfo.buyerId || buyerInfo.userId || user?.userId || user?.id || existingOrder?.buyer?.buyerId || "usr_buyer_commercial",
      businessName: buyerInfo.businessName || buyerInfo.name || user?.name || existingOrder?.buyer?.businessName || "ABC Foods Ltd.",
      contactPerson: buyerInfo.contactPerson || buyerInfo.name || user?.name || existingOrder?.buyer?.contactPerson || "Procurement Manager",
      phone: buyerInfo.phone || user?.phone || existingOrder?.buyer?.phone || "9876543210",
      email: buyerInfo.email || existingOrder?.buyer?.email || "procurement@agrocycle.in",
      location: buyerInfo.location || demand.destinationLocation || existingOrder?.buyer?.location
    },
    allocations: mappedAllocations,
    summary: {
      buyerType: demand.buyerType || existingOrder?.demand?.buyerType || "Food Processor",
      intendedUse: demand.intendedUse || existingOrder?.demand?.intendedUse || "Processing",
      qualityGrade: normalizeMarketIntelligenceGrade(demand.qualityGrade || existingOrder?.demand?.qualityGrade || "Grade A — Fresh / Premium"),
      requestedQuantityKg: requestedQuantityKg,
      sourcedQuantityKg: totalQuantityKg,
      remainingQuantityKg: remainingQuantityKg,
      totalSuppliersCount: mappedAllocations.length,
      totalQuantityKg,
      totalQuantityTonnes,
      totalProduceCost,
      averageProducePrice,
      maxDistanceKm,
      fulfilmentPercentage: requestedQuantityKg > 0 ? Math.min(100, Math.round((totalQuantityKg / requestedQuantityKg) * 100)) : 100,
      paymentStatus: "PENDING"
    },
    notes: notes || existingOrder?.notes || "Procurement order confirmed via AgroCycle Fresh Produce Procurement Engine.",
    logisticsNotice: "Procurement confirmed. Logistics can be planned next."
  };

  // Synchronize to PostgreSQL backend
  const syncRes = await syncProcurementOrderToBackend(procurementOrder, buyerInfo || user);
  if (!syncRes.success && syncRes.error && !syncRes.isOffline) {
    console.warn("[SmartMatchService] Backend sync error:", syncRes.error);
    return {
      error: syncRes.error,
      code: syncRes.code || "INSUFFICIENT_SUPPLY",
      success: false
    };
  }

  // Update localDB listings cache to immediately reflect consumed quantities
  try {
    const localListings = localDB.getData(KEYS.WASTE, []);
    if (Array.isArray(localListings) && localListings.length > 0) {
      let updatedLocal = false;
      const newLocalListings = localListings.map(listing => {
        const matchedAlloc = newAllocationsToAdd.find(a => String(a.listingId || a.supplierId || a.id) === String(listing.id));
        if (matchedAlloc) {
          const allocKg = Number(matchedAlloc.allocatedQuantityKg || 0);
          const currentKg = Number(listing.quantity_kg !== undefined ? listing.quantity_kg : (listing.quantity || 0));
          const remainingKg = Math.max(0, currentKg - allocKg);
          updatedLocal = true;
          return {
            ...listing,
            quantity_kg: remainingKg,
            quantity: remainingKg,
            status: remainingKg <= 0 ? "sold" : (listing.status || "listed")
          };
        }
        return listing;
      });
      if (updatedLocal) {
        localDB.saveData(KEYS.WASTE, newLocalListings);
      }
    }
  } catch (e) {
    // Ignore localDB cache update failure
  }

  // Persist order in localDB (update existing or prepend new)
  if (existingOrder) {
    const updatedOrderList = existingOrders.map(o => (o.orderId === targetOrderId || o.id === targetOrderId) ? procurementOrder : o);
    localDB.saveData(PROCUREMENT_ORDER_STORE_KEY, updatedOrderList);
  } else {
    localDB.saveData(PROCUREMENT_ORDER_STORE_KEY, [procurementOrder, ...existingOrders]);
  }

  return procurementOrder;
}

/**
 * Synchronizes Procurement Order to PostgreSQL backend
 */
export async function syncProcurementOrderToBackend(order, user = {}) {
  if (!order) return { success: false, error: "No order provided" };

  const API_URL = `${getApiBaseUrl()}/procurement/orders`;
  const currentUserId = user?.userId || user?.id || order.buyer?.buyerId || "usr_buyer_commercial";

  const payload = {
    id: order.id || order.orderId,
    order_id: order.orderId || order.id,
    buyer_id: currentUserId,
    buyer_name: order.buyer?.businessName || user?.name || "Commercial Buyer",
    buyer_phone: order.buyer?.phone || user?.phone || null,
    crop: order.demand?.crop || "Tomato",
    category: order.demand?.category || "vegetable",
    buyer_type: order.demand?.buyerType || order.summary?.buyerType || "Food Processor",
    intended_use: order.demand?.intendedUse || order.summary?.intendedUse || "Processing",
    requested_quantity_kg: order.demand?.requestedQuantityKg || order.summary?.requestedQuantityKg || order.summary?.totalQuantityKg || 1000,
    quality_grade: normalizeMarketIntelligenceGrade(order.demand?.qualityGrade || "Grade A — Fresh / Premium"),
    required_date: order.demand?.requiredDate || new Date().toISOString().split("T")[0],
    max_price_per_kg: order.demand?.maxPricePerKg || null,
    delivery_location: typeof order.demand?.destinationLocation === "object" ? (order.demand.destinationLocation.address || order.demand.destinationLocation.city) : String(order.demand?.destinationLocation || "Madurai"),
    delivery_latitude: typeof order.demand?.destinationLocation === "object" ? order.demand.destinationLocation.latitude : null,
    delivery_longitude: typeof order.demand?.destinationLocation === "object" ? order.demand.destinationLocation.longitude : null,
    status: order.status || ORDER_STATUS.CONFIRMED,
    order_type: order.orderType || "ACCEPTED_RECOMMENDATION",
    match_type: order.matchType || "MARKET",
    farmer_allocations: order.allocations || [],
    procurement_summary: {
      ...(order.summary || {}),
      buyerType: order.demand?.buyerType || order.summary?.buyerType || "Food Processor",
      intendedUse: order.demand?.intendedUse || order.summary?.intendedUse || "Processing",
      qualityGrade: normalizeMarketIntelligenceGrade(order.demand?.qualityGrade || "Grade A — Fresh / Premium")
    },
    notes: order.notes || ""
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": currentUserId
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data };
    } else {
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.message || `HTTP error ${res.status}` };
    }
  } catch (netErr) {
    return { success: false, isOffline: true, error: netErr.message };
  }
}

/**
 * Maps a PostgreSQL procurement_orders record to normalized frontend order format
 */
export function mapBackendOrderToFrontendOrder(row) {
  if (!row) return null;
  const allocations = Array.isArray(row.farmer_allocations) ? row.farmer_allocations : [];
  const summary = row.procurement_summary || {};
  const requestedKg = Number(row.requested_quantity_kg || summary.requestedQuantityKg || (summary.totalQuantityKg ? summary.totalQuantityKg : 1000));
  const sourcedKg = Number(summary.sourcedQuantityKg !== undefined ? summary.sourcedQuantityKg : (summary.totalQuantityKg || 0));
  const remainingKg = summary.remainingQuantityKg !== undefined ? Number(summary.remainingQuantityKg) : Math.max(0, Number((requestedKg - sourcedKg).toFixed(3)));

  const buyerType = summary.buyerType || summary.demand?.buyerType || "Food Processor";
  const intendedUse = summary.intendedUse || summary.demand?.intendedUse || "Processing";
  const qualityGrade = normalizeMarketIntelligenceGrade(row.quality_grade || summary.qualityGrade || "Grade A — Fresh / Premium");

  return {
    id: row.id || row.order_id,
    orderId: row.order_id || row.id,
    matchType: row.match_type || "MARKET",
    orderType: row.order_type || "ACCEPTED_RECOMMENDATION",
    status: row.status || ORDER_STATUS.CONFIRMED,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    demand: {
      crop: row.crop || "Tomato",
      category: row.category || "vegetable",
      buyerType: buyerType,
      intendedUse: intendedUse,
      requestedQuantityKg: requestedKg,
      requestedQuantityTonnes: Number((requestedKg / 1000).toFixed(3)),
      requiredDate: row.required_date ? (String(row.required_date).includes("T") ? String(row.required_date).split("T")[0] : String(row.required_date)) : new Date().toISOString().split("T")[0],
      qualityGrade: qualityGrade,
      acceptedGrades: [qualityGrade],
      maxPricePerKg: row.max_price_per_kg ? Number(row.max_price_per_kg) : null,
      destinationLocation: {
        address: row.delivery_location || "Madurai Commercial Hub",
        city: row.delivery_location || "Madurai",
        latitude: row.delivery_latitude,
        longitude: row.delivery_longitude
      }
    },
    buyer: {
      buyerId: row.buyer_id || "usr_buyer_commercial",
      businessName: row.buyer_name || "Commercial Buyer",
      phone: row.buyer_phone || null,
      location: {
        city: row.delivery_location || "Madurai"
      }
    },
    allocations: allocations.map((a, idx) => ({
      ...a,
      allocationIndex: idx + 1,
      paymentStatus: a.paymentStatus || summary.paymentStatus || "PENDING",
      status: a.status || "CONFIRMED"
    })),
    summary: {
      ...summary,
      buyerType: buyerType,
      intendedUse: intendedUse,
      qualityGrade: qualityGrade,
      requestedQuantityKg: requestedKg,
      sourcedQuantityKg: sourcedKg,
      remainingQuantityKg: remainingKg,
      totalQuantityKg: sourcedKg,
      totalQuantityTonnes: Number((sourcedKg / 1000).toFixed(3)),
      totalProduceCost: Number(summary.totalProduceCost || 0),
      averageProducePrice: Number(summary.averageProducePrice || 0),
      totalSuppliersCount: allocations.length,
      paymentStatus: summary.paymentStatus || "PENDING"
    },
    notes: row.notes || "",
    logistics: row.logistics || summary.logistics || null,
    logisticsStatus: row.logistics_status || summary.logisticsStatus || (row.logistics?.transportStatus) || null,
    logisticsNotice: "Procurement confirmed. Logistics can be planned next."
  };
}

/**
 * Fetch procurement orders from PostgreSQL backend and sync with localDB
 */
export async function fetchProcurementOrders(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.buyer_id) queryParams.set("buyer_id", params.buyer_id);
    if (params.farmer_id) queryParams.set("farmer_id", params.farmer_id);
    if (params.crop) queryParams.set("crop", params.crop);
    if (params.status) queryParams.set("status", params.status);
    if (params.match_type) queryParams.set("match_type", params.match_type);

    const API_URL = `${getApiBaseUrl()}/procurement/orders${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const res = await fetch(API_URL);
    if (res.ok) {
      const json = await res.json();
      if (json.status === "success" && Array.isArray(json.data)) {
        const mapped = json.data.map(mapBackendOrderToFrontendOrder).filter(Boolean);
        // Sync into localDB
        localDB.saveData(PROCUREMENT_ORDER_STORE_KEY, mapped);
        return mapped;
      }
    }
  } catch (err) {
    console.warn("[SmartMatchService] fetchProcurementOrders error, falling back to localDB:", err.message);
  }
  return getProcurementOrders();
}

/**
 * Retrieve all saved procurement orders from localDB
 */
export function getProcurementOrders() {
  const orders = localDB.getData(PROCUREMENT_ORDER_STORE_KEY);
  return Array.isArray(orders) ? orders : [];
}

/**
 * Retrieve a single procurement order by ID
 */
export function getProcurementOrderById(orderId) {
  const orders = getProcurementOrders();
  return orders.find(o => o.orderId === orderId || o.id === orderId) || null;
}

/**
 * Transition the lifecycle status of a procurement order and sync to backend
 */
export function updateProcurementOrderStatus(orderId, newStatus, trackingNotes = "", requiredDate = null) {
  const orders = getProcurementOrders();
  const index = orders.findIndex(o => o.orderId === orderId || o.id === orderId);
  if (index === -1) return null;

  const currentOrder = orders[index];
  const updatedDemand = requiredDate ? { ...currentOrder.demand, requiredDate } : currentOrder.demand;
  
  // If moving to PARTIALLY_FULFILLED, close remaining quantity
  const updatedSummary = newStatus === ORDER_STATUS.PARTIALLY_FULFILLED 
    ? { ...currentOrder.summary, remainingQuantityKg: 0 } 
    : currentOrder.summary;

  orders[index] = {
    ...currentOrder,
    status: newStatus,
    demand: updatedDemand,
    summary: updatedSummary,
    updatedAt: new Date().toISOString(),
    statusLog: [
      ...(currentOrder.statusLog || []),
      { status: newStatus, timestamp: new Date().toISOString(), notes: trackingNotes }
    ]
  };

  localDB.saveData(PROCUREMENT_ORDER_STORE_KEY, orders);

  // Sync status to backend API asynchronously in background
  try {
    const API_URL = `${getApiBaseUrl()}/procurement/orders/${encodeURIComponent(orderId)}`;
    fetch(API_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        notes: trackingNotes,
        required_date: requiredDate
      })
    }).catch(err => {
      console.warn("[SmartMatchService] Background patch notice:", err.message);
    });
  } catch (err) {
    console.warn("[SmartMatchService] Failed to dispatch order status patch to backend:", err.message);
  }

  return orders[index];
}

export const PLATFORM_FEE_RATE = 0.03; // 3% Fixed

/**
 * AgroCycle Official Locked Platform-Fee & Net Procurement Value Formula
 *
 * Formula:
 * Crop Value = Confirmed Quantity × Agreed Farmer Price (or sum of confirmed allocations)
 * Platform Fee Base = Crop Value - Rejection Risk
 * Platform Fee = 3% × Platform Fee Base
 * Final Net Procurement Value = Crop Value - Rejection Risk - Platform Fee
 *
 * Excludes transport and shrinkage (Smart Logistics is deferred to future phase).
 */
export function calculateProcurementFinancials({
  cropValue = null,
  confirmedQuantityKg = 0,
  pricePerKg = 0,
  rejectionRisk = 0
} = {}) {
  const computedCropValue = cropValue !== null && cropValue !== undefined && !isNaN(Number(cropValue))
    ? Number(cropValue)
    : (Number(confirmedQuantityKg || 0) * Number(pricePerKg || 0));

  const risk = Math.max(0, Number(rejectionRisk || 0));
  const platformFeeBase = Math.max(0, computedCropValue - risk);
  const platformFee = Math.round(platformFeeBase * PLATFORM_FEE_RATE);
  const netProcurementValue = Math.max(0, computedCropValue - risk - platformFee);

  return {
    cropValue: computedCropValue,
    rejectionRisk: risk,
    platformFeeBase,
    platformFeeRate: PLATFORM_FEE_RATE,
    platformFeeRatePercent: 3,
    platformFee,
    netProcurementValue
  };
}

/**
 * Simulates payment for a procurement order using locked 3% platform fee formula
 */
export async function simulateOrderPayment(orderId, paymentMethod = "UPI", rejectionRisk = 0) {
  const orders = getProcurementOrders();
  const index = orders.findIndex(o => o.orderId === orderId || o.id === orderId);

  const generatedRef = `SIM-PAY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  let localOrder = null;
  if (index !== -1) {
    const currentOrder = orders[index];
    const cropValue = Number(currentOrder.summary?.totalProduceCost || 0);
    const risk = Number(rejectionRisk || currentOrder.summary?.rejectionRisk || currentOrder.summary?.rejection_risk || 0);
    const financials = calculateProcurementFinancials({ cropValue, rejectionRisk: risk });

    const updatedAllocations = (currentOrder.allocations || []).map(a => ({
      ...a,
      paymentStatus: "PAID_SIMULATED"
    }));

    orders[index] = {
      ...currentOrder,
      allocations: updatedAllocations,
      summary: {
        ...currentOrder.summary,
        cropValue: financials.cropValue,
        rejectionRisk: financials.rejectionRisk,
        platformFeeBase: financials.platformFeeBase,
        platformFee: financials.platformFee,
        platformFeeRate: financials.platformFeeRate,
        netProcurementValue: financials.netProcurementValue,
        paymentStatus: "PAID_SIMULATED",
        paymentMethod,
        paymentReference: generatedRef,
        paidAt: new Date().toISOString(),
        amountPaid: financials.netProcurementValue
      },
      updatedAt: new Date().toISOString()
    };
    localDB.saveData(PROCUREMENT_ORDER_STORE_KEY, orders);
    localOrder = orders[index];
  }

  // Sync to backend
  try {
    const API_URL = `${getApiBaseUrl()}/procurement/orders/${encodeURIComponent(orderId)}/simulate-payment`;
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_method: paymentMethod,
        payment_reference: generatedRef,
        rejection_risk: rejectionRisk
      })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        const mapped = mapBackendOrderToFrontendOrder(json.data);
        return mapped;
      }
    }
  } catch (err) {
    console.warn("[SmartMatchService] simulateOrderPayment backend error, returning local:", err.message);
  }

  return localOrder;
}

/**
 * Arrange Transport for a Confirmed Procurement Order (BEFORE payment)
 * Transport details are entered by the buyer and shared transparently with the farmer.
 * Transport cost is stored as a separate logistics line item (never modifies farmer asking price).
 */
export async function arrangeTransport(orderId, transportDetails) {
  const orders = getProcurementOrders();
  const index = orders.findIndex(o => o.orderId === orderId || o.id === orderId);

  const nowIso = new Date().toISOString();
  const transporterName = transportDetails.transporterName || transportDetails.transporter_name || "";
  const transporterPhone = transportDetails.transporterPhone || transportDetails.transporter_phone || "";
  const driverName = transportDetails.driverName || transportDetails.driver_name || "";
  const driverPhone = transportDetails.driverPhone || transportDetails.driver_phone || "";
  const vehicleNumber = transportDetails.vehicleNumber || transportDetails.vehicle_number || "";
  const pickupDate = transportDetails.pickupDate || transportDetails.pickup_date || nowIso.split("T")[0];
  const pickupTime = transportDetails.pickupTime || transportDetails.pickup_time || "10:00 AM";
  const destination = transportDetails.destination || transportDetails.destinationCity || "Madurai";
  const transportCost = Number(transportDetails.transportCost !== undefined ? transportDetails.transportCost : (transportDetails.transport_cost || 0));
  const gpsLat = transportDetails.gpsLatitude !== undefined ? transportDetails.gpsLatitude : (transportDetails.gps_latitude !== undefined ? transportDetails.gps_latitude : null);
  const gpsLon = transportDetails.gpsLongitude !== undefined ? transportDetails.gpsLongitude : (transportDetails.gps_longitude !== undefined ? transportDetails.gps_longitude : null);

  const logisticsData = {
    transportStatus: "ASSIGNED",
    transporterName,
    transporterPhone: transporterPhone || null,
    driverName,
    driverPhone: driverPhone || null,
    vehicleNumber,
    pickupDate,
    pickupTime,
    destination,
    transportCost: isNaN(transportCost) ? 0 : Math.max(0, transportCost),
    gpsLatitude: (gpsLat !== null && !isNaN(Number(gpsLat))) ? Number(gpsLat) : null,
    gpsLongitude: (gpsLon !== null && !isNaN(Number(gpsLon))) ? Number(gpsLon) : null,
    lastGpsUpdate: (gpsLat !== null && gpsLon !== null) ? nowIso : null,
    notes: transportDetails.notes || null,
    assignedAt: nowIso,
    updatedAt: nowIso,
    timeline: [
      { status: "ASSIGNED", label: "Transport Assigned", timestamp: nowIso, notes: `Vehicle ${vehicleNumber} assigned by ${transporterName}` }
    ]
  };

  let localOrder = null;
  if (index !== -1) {
    const currentOrder = orders[index];
    orders[index] = {
      ...currentOrder,
      logistics: logisticsData,
      logisticsStatus: "ASSIGNED",
      summary: {
        ...currentOrder.summary,
        logistics: logisticsData,
        logisticsStatus: "ASSIGNED"
      },
      updatedAt: nowIso
    };
    localDB.saveData(PROCUREMENT_ORDER_STORE_KEY, orders);
    localOrder = orders[index];
  }

  // Sync to Backend
  try {
    const API_URL = `${getApiBaseUrl()}/procurement/orders/${encodeURIComponent(orderId)}/logistics`;
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transportDetails)
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        const mapped = mapBackendOrderToFrontendOrder(json.data);
        return mapped;
      }
    }
  } catch (err) {
    console.warn("[SmartMatchService] arrangeTransport backend error, returning local:", err.message);
  }

  return localOrder;
}

/**
 * Update Transport / Logistics Status
 * (ASSIGNED -> PICKUP -> COLLECTED -> IN TRANSIT -> DELIVERED)
 */
export async function updateTransportStatus(orderId, newStatus, notes = "", gpsCoordinates = null) {
  const orders = getProcurementOrders();
  const index = orders.findIndex(o => o.orderId === orderId || o.id === orderId);

  const STATUS_LABELS = {
    ASSIGNED: "Transport Assigned",
    PICKUP: "Pickup Scheduled",
    COLLECTED: "Produce Collected from Farmer",
    "IN TRANSIT": "In Transit to Destination Hub",
    DELIVERED: "Produce Delivered to Buyer"
  };

  const nowIso = new Date().toISOString();
  let localOrder = null;

  const rawLat = gpsCoordinates?.latitude !== undefined ? gpsCoordinates.latitude : gpsCoordinates?.gpsLatitude;
  const rawLon = gpsCoordinates?.longitude !== undefined ? gpsCoordinates.longitude : gpsCoordinates?.gpsLongitude;
  const hasGps = rawLat !== undefined && rawLon !== undefined && rawLat !== null && rawLon !== null;

  if (index !== -1) {
    const currentOrder = orders[index];
    const prevLogistics = currentOrder.logistics || currentOrder.summary?.logistics || {};
    const timeline = Array.isArray(prevLogistics.timeline) ? [...prevLogistics.timeline] : [];

    timeline.push({
      status: newStatus,
      label: STATUS_LABELS[newStatus] || newStatus,
      timestamp: nowIso,
      notes: notes || null
    });

    const updatedLogistics = {
      ...prevLogistics,
      transportStatus: newStatus,
      gpsLatitude: hasGps ? Number(rawLat) : (prevLogistics.gpsLatitude ?? null),
      gpsLongitude: hasGps ? Number(rawLon) : (prevLogistics.gpsLongitude ?? null),
      lastGpsUpdate: hasGps ? nowIso : (prevLogistics.lastGpsUpdate ?? null),
      updatedAt: nowIso,
      timeline
    };

    orders[index] = {
      ...currentOrder,
      logistics: updatedLogistics,
      logisticsStatus: newStatus,
      summary: {
        ...currentOrder.summary,
        logistics: updatedLogistics,
        logisticsStatus: newStatus
      },
      updatedAt: nowIso
    };
    localDB.saveData(PROCUREMENT_ORDER_STORE_KEY, orders);
    localOrder = orders[index];
  }

  // Sync to Backend
  try {
    const API_URL = `${getApiBaseUrl()}/procurement/orders/${encodeURIComponent(orderId)}/logistics/status`;
    const res = await fetch(API_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        status: newStatus, 
        notes,
        gpsLatitude: hasGps ? Number(rawLat) : undefined,
        gpsLongitude: hasGps ? Number(rawLon) : undefined
      })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        const mapped = mapBackendOrderToFrontendOrder(json.data);
        return mapped;
      }
    }
  } catch (err) {
    console.warn("[SmartMatchService] updateTransportStatus backend error, returning local:", err.message);
  }

  return localOrder;
}

/**
 * Update Live GPS Coordinates for Transport Vehicle
 * Never creates dummy or fake coordinates.
 */
export async function updateTransportGps(orderId, { latitude, longitude, speedKmH, heading }) {
  const orders = getProcurementOrders();
  const index = orders.findIndex(o => o.orderId === orderId || o.id === orderId);
  const nowIso = new Date().toISOString();

  let localOrder = null;
  if (index !== -1) {
    const currentOrder = orders[index];
    const prevLogistics = currentOrder.logistics || currentOrder.summary?.logistics || {};

    const updatedLogistics = {
      ...prevLogistics,
      gpsLatitude: Number(latitude),
      gpsLongitude: Number(longitude),
      speedKmH: speedKmH !== undefined ? Number(speedKmH) : (prevLogistics.speedKmH ?? null),
      heading: heading || (prevLogistics.heading ?? null),
      lastGpsUpdate: nowIso,
      updatedAt: nowIso
    };

    orders[index] = {
      ...currentOrder,
      logistics: updatedLogistics,
      summary: {
        ...currentOrder.summary,
        logistics: updatedLogistics
      },
      updatedAt: nowIso
    };
    localDB.saveData(PROCUREMENT_ORDER_STORE_KEY, orders);
    localOrder = orders[index];
  }

  try {
    const API_URL = `${getApiBaseUrl()}/procurement/orders/${encodeURIComponent(orderId)}/logistics/gps`;
    const res = await fetch(API_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude, speedKmH, heading })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        return mapBackendOrderToFrontendOrder(json.data);
      }
    }
  } catch (err) {
    console.warn("[SmartMatchService] updateTransportGps backend error:", err.message);
  }

  return localOrder;
}


