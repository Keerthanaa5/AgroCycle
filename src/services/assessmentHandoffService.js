/**
 * AgroCycle Assessment Handoff Service
 *
 * Provides a clean, decoupled mechanism for handing off a completed
 * Viability Scanner field assessment to downstream features (e.g. Urban Waste Matcher).
 *
 * Persists handoff context safely in memory and sessionStorage so that page navigation
 * or refresh delivers the data cleanly to the intended destination without fragile React state.
 */

const STORAGE_KEY = "agrocycle_assessment_handoff";

let memoryHandoff = null;

/**
 * Format readable location string from GPS/address metadata without duplicate entries.
 * E.g.: "Madurai, Tamil Nadu"
 */
export function formatReadableLocation(loc) {
  if (!loc) return "";
  if (typeof loc === "string") return loc.trim();

  const parts = [];
  const city = loc.city?.trim();
  const district = loc.district?.trim();
  const state = loc.state?.trim();
  const country = loc.country?.trim();

  if (city) {
    parts.push(city);
  }

  // Avoid duplicating district if district is identical to city or contains city name
  if (district && (!city || !district.toLowerCase().includes(city.toLowerCase()))) {
    parts.push(district);
  }

  if (state) {
    parts.push(state);
  }

  if (parts.length === 0 && country && country !== "India") {
    parts.push(country);
  }

  if (parts.length > 0) {
    return parts.join(", ");
  }

  if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
    return `${loc.latitude.toFixed(4)}° N, ${loc.longitude.toFixed(4)}° E`;
  }

  return "";
}

/**
 * Map Viability Scanner condition / quality to Urban Waste Matcher condition keys
 * ("slightly_damaged" | "damaged" | "heavily_damaged")
 */
export function mapConditionToWasteMarket(conditionKey, conditionQuality) {
  const c = (conditionQuality || conditionKey || "").toLowerCase();
  if (c === "slightly_damaged") return "slightly_damaged";
  if (c === "damaged" || c === "off_grade" || c === "high") return "damaged";
  if (c === "heavily_damaged" || c === "critical") return "heavily_damaged";
  if (c === "surplus" || c === "fresh_market_grade" || c === "low" || c === "medium") return "slightly_damaged";
  return "slightly_damaged";
}

/**
 * Creates a standardized handoff payload from a completed Field Assessment result.
 *
 * CRITICAL RULE: Cultivated acreage is NOT quantity.
 * Acreage remains in metadata but never populates quantity.value.
 */
export function createHandoffFromAssessment(assessment, destination = "urban-waste-matcher") {
  if (!assessment) return null;

  const assessmentId = assessment.id || `assessment_${Date.now()}`;
  const crop = assessment.cropName || assessment.crop || "Crop";
  const condition = assessment.condition || assessment.farmerContext?.condition || "unknown";
  const conditionQuality = assessment.farmerContext?.condition || assessment.conditionQuality || "not_sure";
  const cultivatedAcres = Number(assessment.fieldArea || assessment.farmerContext?.fieldArea || 1);

  // Commercial context: Only use actual entered quantity and expected price if provided
  let quantityValue = null;
  let quantityUnit = "kg";
  const comm = assessment.commercialContext || {};
  if (comm.availableQuantity !== null && comm.availableQuantity !== undefined && comm.availableQuantity > 0) {
    quantityValue = Number(comm.availableQuantity);
    quantityUnit = comm.quantityUnit || "kg";
  }

  let askingPrice = null;
  if (comm.expectedPrice !== null && comm.expectedPrice !== undefined && comm.expectedPrice > 0) {
    askingPrice = Number(comm.expectedPrice);
  }

  // Location
  const location = assessment.location || null;
  const readableLocation =
    formatReadableLocation(location) ||
    (comm.village || comm.district || comm.state
      ? [comm.village, comm.district, comm.state].filter(Boolean).join(", ")
      : "");

  // Spatial images: prefer Centre zone image if available
  const samples = assessment.samples || [];
  const centreSample = samples.find((s) => s.zone === "centre" && s.image);
  const selectedImage = centreSample?.image || samples.find((s) => s.image)?.image || assessment.image || null;

  const images = samples
    .filter((s) => s.image)
    .map((s) => ({
      zone: s.zone || "general",
      image: s.image,
      primaryDisease: s.primaryDisease,
      hasDisease: s.hasDisease
    }));

  const availabilityDate = comm.availableFrom || comm.availabilityDate || assessment.availabilityDate || null;

  const damageLossDate = assessment.damageLossDate || assessment.farmerContext?.damageLossDate || null;
  const lossTimeOfDay = assessment.lossTimeOfDay || assessment.farmerContext?.lossTimeOfDay || "unknown";
  const reportedDamageExtent = assessment.reportedDamageExtent || assessment.farmerContext?.reportedDamageExtent || "not_sure";
  const reportedPeril = assessment.reportedPeril || assessment.farmerContext?.reportedPeril || assessment.farmerReported?.reportedPeril || null;
  const problemDistribution = assessment.problemDistribution || assessment.farmerContext?.problemDistribution || "unknown";
  const materialState = assessment.materialState || assessment.farmerContext?.materialType || "standing_crop";
  const claimWindowStatus = assessment.claimWindowStatus || assessment.rescueDecision?.claimWindowStatus || "not_applicable";
  const claimRoutingPriority = assessment.claimRoutingPriority || assessment.rescueDecision?.claimRoutingPriority || "standard";
  const claimRoutingReason = assessment.claimRoutingReason || assessment.rescueDecision?.claimRoutingReason || null;
  const isPriorityPath = Boolean(assessment.isPriorityPath || assessment.rescueDecision?.isPriorityPath);

  return {
    source: "viability-scanner",
    destination,
    assessmentId,
    crop,
    condition,
    conditionQuality,
    materialState,
    materialType: materialState,
    mappedCondition: mapConditionToWasteMarket(condition, conditionQuality),
    cultivatedAcres,
    fieldArea: cultivatedAcres,
    availabilityDate,
    damageLossDate,
    lossTimeOfDay,
    reportedDamageExtent,
    reportedPeril,
    problemDistribution,
    claimWindowStatus,
    claimRoutingPriority,
    claimRoutingReason,
    isPriorityPath,
    quantity: {
      value: quantityValue,
      unit: quantityUnit
    },
    location,
    readableLocation,
    askingPrice,
    selectedImage,
    images,
    samples: assessment.samples || [],
    zoneResults: assessment.zoneResults || {},
    samplingRepresentation: assessment.samplingRepresentation || null,
    assessmentDate: assessment.date || new Date().toISOString().split("T")[0],
    assessmentTimestamp: assessment.timestamp || new Date().toISOString(),
    visualEvidence: {
      cropName: crop,
      primaryDisease: assessment.primaryDisease || null,
      highestConfidence: assessment.highestConfidence || 0,
      visualCoverage: assessment.visualCoverage || 0,
      AIVisualDiseaseBurden: assessment.diseaseBurdenScore ?? assessment.AIVisualDiseaseBurden ?? 0,
      burdenCategory: assessment.burdenCategory || "Low",
      positiveZonesCount: assessment.positiveZonesCount || 0,
      totalValidSamples: assessment.totalValidSamples || (assessment.samples ? assessment.samples.length : 5),
      sampleConsistencyText: assessment.sampleConsistencyText || "",
      positiveZonesText: assessment.positiveZonesText || "",
      zoneEvidenceText: assessment.zoneEvidenceText || "",
      fieldVisualConcern: assessment.fieldVisualConcern || ""
    },
    farmerReported: {
      crop,
      acres: cultivatedAcres,
      condition: conditionQuality,
      materialState,
      reportedDamageExtent,
      reportedPeril,
      damageLossDate,
      lossTimeOfDay,
      problemDistribution,
      insuranceClaimIntent: assessment.farmerContext?.insuranceInterest || "unknown"
    },
    recommendation: {
      pathway: assessment.finalRecommendation?.feature || "Urban Waste Matcher",
      action: assessment.finalRecommendation?.action || "",
      reason: assessment.finalRecommendation?.reason || "",
      isPriorityPath,
      priorityTitle: assessment.finalRecommendation?.priorityTitle || null
    }
  };
}

/**
 * Stores the handoff context in memory and sessionStorage
 */
export function setAssessmentHandoff(handoffData) {
  memoryHandoff = handoffData;
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handoffData));
    }
  } catch (e) {
    console.warn("[assessmentHandoffService] sessionStorage set error:", e);
  }
}

/**
 * Retrieves the pending handoff context without clearing it
 */
export function getAssessmentHandoff(destination = null) {
  let handoff = memoryHandoff;
  if (!handoff) {
    try {
      if (typeof sessionStorage !== "undefined") {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          handoff = JSON.parse(raw);
          memoryHandoff = handoff;
        }
      }
    } catch (e) {
      console.warn("[assessmentHandoffService] sessionStorage get error:", e);
    }
  }

  if (handoff && destination && handoff.destination !== destination) {
    return null;
  }
  return handoff;
}

/**
 * Consumes and clears the pending handoff for the destination
 */
export function consumeAssessmentHandoff(destination = null) {
  const handoff = getAssessmentHandoff(destination);
  if (handoff) {
    clearAssessmentHandoff();
  }
  return handoff;
}

/**
 * Clears any pending handoff
 */
export function clearAssessmentHandoff() {
  memoryHandoff = null;
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {}
}

/**
 * Checks if a pending handoff exists for the destination
 */
export function hasPendingHandoff(destination = null) {
  const h = getAssessmentHandoff(destination);
  return Boolean(h);
}
