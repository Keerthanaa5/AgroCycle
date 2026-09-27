/**
 * AgroCycle Buyer Matching Engine (Layer C — Market Intelligence)
 *
 * Matches farmer crops with actual registered commercial buyers using:
 * 1. Commodity / Crop match
 * 2. Geographic proximity via Haversine distance
 * 3. Buyer maximum procurement radius
 * 4. Quantity requirements & target pricing
 *
 * CRITICAL RULE:
 * Matches ONLY genuine registered buyers from the database.
 * Never fabricates buyers or claims "nearest buyer" without genuine database presence.
 */

import { getRegisteredBuyers } from "./buyerService.js";
import { normalizeCropName, KNOWN_CROP_ALIASES } from "./marketPriceService.js";

/**
 * Calculates great-circle distance between two GPS coordinates in kilometers (Haversine formula).
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number|null} Distance in km rounded to 1 decimal place, or null if coordinates invalid.
 */
export function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== "number" || isNaN(lat1) ||
    typeof lon1 !== "number" || isNaN(lon1) ||
    typeof lat2 !== "number" || isNaN(lat2) ||
    typeof lon2 !== "number" || isNaN(lon2)
  ) {
    return null;
  }

  const R = 6371; // Earth's radius in kilometers
  const toRad = (deg) => deg * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10;
}

/**
 * Find matching registered buyers for a given crop and location.
 *
 * @param {Object} params
 * @param {string} params.crop - Farmer's crop name (e.g. "Tomato")
 * @param {number} [params.quantity] - Farmer's available quantity (kg)
 * @param {Object|string} [params.farmerLocation] - GPS coordinates / readable location
 * @param {string} [params.condition] - Crop condition
 * @param {number} [params.maxDistanceKm] - Optional distance cap
 * @param {Array} [params.buyersList] - Optional custom buyers list (for tests/dependency injection)
 * @returns {Object} { count, buyers, hasGps, message }
 */
export function findMatchingBuyers({
  crop,
  quantity = null,
  farmerLocation = null,
  condition = null,
  maxDistanceKm = null,
  buyersList = null
} = {}) {
  if (!crop || typeof crop !== "string" || crop.trim() === "") {
    return {
      count: 0,
      buyers: [],
      hasGps: false,
      message: "Please specify a crop to find matching registered buyers."
    };
  }

  const trimmedCrop = crop.trim();
  if (trimmedCrop.length < 3) {
    return {
      count: 0,
      buyers: [],
      hasGps: false,
      message: "Enter a complete crop name to find matching registered buyers."
    };
  }

  const farmerCropNorm = normalizeCropName(trimmedCrop);
  const farmerCanonical = KNOWN_CROP_ALIASES[farmerCropNorm] || farmerCropNorm;

  const allBuyers = buyersList || getRegisteredBuyers();

  // Extract farmer GPS coordinates if available
  let farmerLat = null;
  let farmerLon = null;
  let farmerCity = null;

  if (farmerLocation && typeof farmerLocation === "object") {
    if (typeof farmerLocation.latitude === "number" && typeof farmerLocation.longitude === "number") {
      farmerLat = farmerLocation.latitude;
      farmerLon = farmerLocation.longitude;
    }
    farmerCity = (farmerLocation.city || farmerLocation.district || "").toLowerCase().trim();
  } else if (typeof farmerLocation === "string") {
    farmerCity = farmerLocation.toLowerCase().trim();
  }

  const hasGps = typeof farmerLat === "number" && typeof farmerLon === "number";

  const matched = [];

  for (const buyer of allBuyers) {
    if (!buyer.requirements || !Array.isArray(buyer.requirements)) continue;

    // Check if buyer has requirement matching this crop (exact normalized match)
    const matchingReqs = buyer.requirements.filter((req) => {
      if (!req.crop) return false;
      const reqCropNorm = normalizeCropName(req.crop);
      const reqCanonical = KNOWN_CROP_ALIASES[reqCropNorm] || reqCropNorm;
      return farmerCanonical && reqCanonical && farmerCanonical === reqCanonical;
    });

    if (matchingReqs.length === 0) continue;

    const topReq = matchingReqs[0];

    // Distance calculation
    let distanceKm = null;
    let isWithinRadius = true;

    if (hasGps && buyer.location?.latitude && buyer.location?.longitude) {
      distanceKm = calculateHaversineDistanceKm(
        farmerLat,
        farmerLon,
        buyer.location.latitude,
        buyer.location.longitude
      );

      const maxAllowedRadius = maxDistanceKm || buyer.buyingRadiusKm || 100;
      if (distanceKm !== null && distanceKm > maxAllowedRadius) {
        isWithinRadius = false;
      }
    } else if (farmerCity && buyer.location?.city) {
      // Fallback city comparison if GPS not present
      const buyerCity = buyer.location.city.toLowerCase().trim();
      const cityMatches = farmerCity.includes(buyerCity) || buyerCity.includes(farmerCity);
      if (!cityMatches && !hasGps) {
        // If neither GPS nor city matches, check district or state
        const buyerState = (buyer.location.state || "").toLowerCase();
        const farmerState = (farmerLocation?.state || "").toLowerCase();
        if (farmerState && buyerState && farmerState !== buyerState) {
          isWithinRadius = false;
        }
      }
    }

    if (!isWithinRadius) continue;

    matched.push({
      buyerId: buyer.buyerId,
      businessName: buyer.businessName,
      businessType: buyer.businessType || "Commercial Buyer",
      location: buyer.location,
      distanceKm,
      buyingRadiusKm: buyer.buyingRadiusKm || 50,
      matchedRequirement: {
        crop: topReq.crop,
        variety: topReq.variety || "Standard Grade",
        quantityRequired: topReq.quantityRequired || 0,
        unit: topReq.unit || "kg",
        targetPrice: topReq.targetPrice || null
      },
      contactInformation: buyer.contactInformation || {},
      verificationStatus: buyer.verificationStatus || "profile_completed"
    });
  }

  // Sort by distance ascending (buyers with GPS distance first, then non-GPS)
  matched.sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) {
      return a.distanceKm - b.distanceKm;
    }
    if (a.distanceKm !== null) return -1;
    if (b.distanceKm !== null) return 1;
    return 0;
  });

  const message =
    matched.length > 0
      ? `${matched.length} registered buyer${matched.length > 1 ? "s" : ""} match your ${crop} supply.`
      : "No registered buyers match this crop and location.";

  return {
    count: matched.length,
    buyers: matched,
    hasGps,
    message
  };
}
