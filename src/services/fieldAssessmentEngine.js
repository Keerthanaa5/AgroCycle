import { evaluateRescuePathway, PATHWAY_NAMES } from "./decisionEngine.js";
import { getConfidenceCategory, getBurdenCategory } from "./yoloScanner.js";

/**
 * AgroCycle 5-Point Spatial Sampling Field Assessment Engine
 *
 * Deterministically aggregates evidence across 5 fixed spatial field positions:
 * NORTH, EAST, SOUTH, WEST, CENTRE
 * and merges it with cultivated field acreage (context only) & operational context.
 *
 * CRITICAL AGRONOMIC RULES:
 * 1. Field area (acreage) is strictly FIELD CONTEXT used solely to describe
 *    sampling representation and is NEVER multiplied with disease percentage or visual coverage.
 * 2. Sample consistency (e.g. 3/5 zones positive) means:
 *    "3 / 5 sampled field zones showed disease indicators."
 *    It does NOT estimate or claim a percentage of the entire acre affected (e.g. never "60% of field").
 * 3. Spatial samples represent 5 positions in the field (North, East, South, West, Centre).
 * 4. Assessment runs 100% locally and deterministically.
 */

export const MIN_REQUIRED_SAMPLES = 5;

export const FIELD_ZONES = [
  { id: "north", label: "North" },
  { id: "east", label: "East" },
  { id: "south", label: "South" },
  { id: "west", label: "West" },
  { id: "centre", label: "Centre" }
];

export const REQUIRED_ZONES = ["north", "east", "south", "west", "centre"];

export const ZONE_LABELS = {
  north: "North",
  east: "East",
  south: "South",
  west: "West",
  centre: "Centre"
};

/**
 * Transparent deterministic rule to describe sampling representation based on acreage.
 * (Acreage is context only and NEVER multiplies with disease indices or estimates affected acres)
 *
 * @param {number|string} fieldArea - Cultivated acres
 * @param {number} [sampleCount=5] - Number of spatial points
 */
export function getSamplingRepresentation(fieldArea, sampleCount = 5) {
  const numericAcreage = Number(fieldArea) || 1;
  if (numericAcreage <= 2) {
    return {
      level: "better",
      label: "Better field representation",
      summary: "Better field representation",
      detail: "5-point spatial sampling (North, East, South, West, Centre) provides good representative coverage for the stated field size.",
      recommendation: "Standard 5-point spatial sampling is adequate.",
      acreageNote: "Cultivated area of 2 acres or less with 5 spatial samples offers better field representation."
    };
  } else if (numericAcreage <= 10) {
    return {
      level: "limited",
      label: "Limited field representation",
      summary: "Limited for the stated field size",
      detail: "5 spatial points provide indicative coverage for this field area. Representation is limited for the stated field size.",
      recommendation: "Additional representative sampling may be recommended where appropriate.",
      acreageNote: "Cultivated area (up to 10 acres) with 5 spatial points provides indicative representation."
    };
  } else {
    return {
      level: "very_limited",
      label: "Limited field representation — additional sampling recommended",
      summary: "Limited for the stated field size — additional sampling recommended",
      detail: "For larger field sizes (>10 acres), 5 spatial points provide initial indicative coverage only.",
      recommendation: "Additional representative sampling may be recommended where appropriate.",
      acreageNote: "For large acreage, additional representative sampling across multiple subsections is recommended."
    };
  }
}

/**
 * Aggregates 5 spatial sample results into a unified field-level assessment.
 *
 * @param {Object} input
 * @param {string} input.crop - Entered or detected crop name
 * @param {number|string} input.fieldArea - Cultivated land in acres (context only)
 * @param {string} input.condition - Quality/condition selection ("fresh_market_grade" | "slightly_damaged" | "off_grade" | "surplus" | "other" | "unknown")
 * @param {string} input.materialState - Crop state / material type ("standing_crop" | "crop_residue" | "fodder" | "manure" | "damaged_produce" | "unknown")
 * @param {string} input.burningContext - Open burning risk ("yes" | "no" | "unknown")
 * @param {string} input.insuranceContext - Insurance claim interest ("yes" | "no" | "unknown")
 * @param {string} input.feedContext - Livestock feed intent ("yes" | "no" | "unknown")
 * @param {string} [input.communityContext] - Community exchange interest ("yes" | "no" | "unknown")
 * @param {string} [input.industrialContext] - Industrial processing interest ("yes" | "no" | "unknown")
 * @param {string} input.problemDistribution - "widespread" | "localized" | "unknown"
 * @param {string[]} [input.sampledSections] - Array of sampled sections, e.g. ["North", "South", "East", "West", "Centre"]
 * @param {Array} input.samples - Array of analyzed spatial sample objects (North, East, South, West, Centre)
 * @param {string|null} [input.fieldOverviewPhoto] - Optional field overview photo (context only, NOT sent to YOLO)
 */
export function aggregateFieldAssessment(input) {
  const fc = input?.farmerContext || {};
  const crop = input?.crop || input?.cropName || fc.crop || fc.cropName || "Crop";
  const fieldArea = input?.fieldArea ?? fc.fieldArea ?? 1;
  const condition = input?.condition || fc.condition || "unknown";
  const materialState = input?.materialState || fc.materialType || fc.materialState || "standing_crop";
  const burningContext = input?.burningContext || fc.burningRisk || fc.burningContext || "unknown";
  const insuranceContext = input?.insuranceContext || fc.insuranceInterest || fc.insuranceContext || "unknown";
  const feedContext = input?.feedContext || fc.feedRecoveryInterest || fc.feedContext || "unknown";
  const communityContext = input?.communityContext || fc.communityExchangeInterest || fc.communityContext || "unknown";
  const industrialContext = input?.industrialContext || fc.industrialProcessingInterest || fc.industrialContext || "unknown";
  const problemDistribution = input?.problemDistribution || fc.problemDistribution || "unknown";
  const damageLossDate = input?.damageLossDate || fc.damageLossDate || null;
  const reportedDamageExtent = input?.reportedDamageExtent || fc.reportedDamageExtent || "not_sure";
  const reportedPeril = input?.reportedPeril || fc.reportedPeril || input?.damageType || fc.damageType || null;
  const lossTimeOfDay = input?.lossTimeOfDay || fc.lossTimeOfDay || "unknown";
  const sampledSections = input?.sampledSections || fc.sampledSections || [];
  const samples = input?.samples || [];
  const fieldOverviewPhoto = input?.fieldOverviewPhoto || null;

  // 1. Validate sample count (Minimum 5 required)
  const validSamples = (samples || []).filter(
    (s) => s && (s.isValid !== false && (s.isValid || s.detections !== undefined || s.confidence !== undefined || s.image || s.hasDisease !== undefined))
  );
  const totalValidSamples = validSamples.length;

  if (totalValidSamples < MIN_REQUIRED_SAMPLES) {
    return {
      isAdequate: false,
      totalValidSamples,
      minRequiredSamples: MIN_REQUIRED_SAMPLES,
      error: `5 representative samples are required for a field assessment. (Currently provided: ${totalValidSamples})`,
      message: "5 representative samples are required for a field assessment."
    };
  }

  // Normalize spatial zone for each sample
  const normalizedSamples = validSamples.map((s, idx) => {
    let zone = (s.zone || s.section || "").toLowerCase();
    if (!REQUIRED_ZONES.includes(zone)) {
      zone = REQUIRED_ZONES[idx % REQUIRED_ZONES.length];
    }
    const hasDis = !!s.hasDisease || (s.detections && s.detections.some((d) => d.isDisease));
    const conf = Number(s.highestConfidence ?? s.confidence ?? s.maxConfidence ?? 0);
    const visCov = Number(s.visualCoverage || 0);
    const visBurden = Number(s.visualDiseaseBurden ?? s.burdenScore ?? (hasDis ? 20 : 0));

    return {
      ...s,
      zone,
      zoneLabel: ZONE_LABELS[zone] || zone.charAt(0).toUpperCase() + zone.slice(1),
      hasDisease: hasDis,
      highestConfidence: conf,
      confidence: conf,
      visualCoverage: visCov,
      visualDiseaseBurden: visBurden,
      burdenScore: visBurden,
      status: s.status || "analyzed",
      analyzedAt: s.analyzedAt || Date.now()
    };
  });

  // Construct structured zoneResults dictionary for all 5 spatial positions
  const zoneResults = {};
  REQUIRED_ZONES.forEach((z, idx) => {
    const sampleForZone = normalizedSamples.find((s) => s.zone === z) || normalizedSamples[idx];
    if (sampleForZone) {
      zoneResults[z] = {
        zone: z,
        label: ZONE_LABELS[z],
        id: sampleForZone.id,
        image: sampleForZone.image || null,
        hasDisease: sampleForZone.hasDisease,
        primaryDisease: sampleForZone.primaryDisease || (sampleForZone.hasDisease ? "Disease Indicator" : null),
        highestConfidence: sampleForZone.highestConfidence,
        confidence: sampleForZone.confidence,
        visualCoverage: sampleForZone.visualCoverage,
        visualDiseaseBurden: sampleForZone.visualDiseaseBurden,
        burdenScore: sampleForZone.burdenScore,
        status: sampleForZone.status,
        detections: sampleForZone.detections || [],
        analyzedAt: sampleForZone.analyzedAt
      };
    }
  });

  // 2. Classify positive samples vs clean/unspecified foliage samples
  const positiveSamples = normalizedSamples.filter((s) => s.hasDisease);
  const positiveSamplesCount = positiveSamples.length;
  const healthySamplesCount = totalValidSamples - positiveSamplesCount;

  // 3. Descriptive Sample & Zone Consistency (NEVER mathematical field percentage)
  const sampleConsistencyText = `Detected in ${positiveSamplesCount} of ${totalValidSamples} submitted samples`;
  const positiveZonesText = `${positiveSamplesCount} / ${totalValidSamples} sampled zones`;
  const zoneEvidenceText = `${positiveSamplesCount} / ${totalValidSamples} sampled field zones showed disease indicators.`;
  const positiveRatio = totalValidSamples > 0 ? positiveSamplesCount / totalValidSamples : 0;

  // 4. Detection Confidences
  let highestConfidence = 0;
  let sumPositiveConf = 0;

  if (positiveSamples.length > 0) {
    positiveSamples.forEach((s) => {
      const conf = Number(s.confidence ?? s.maxConfidence ?? s.highestConfidence ?? 0);
      if (conf > highestConfidence) {
        highestConfidence = conf;
      }
      sumPositiveConf += conf;
    });
  } else {
    // If no positive samples, find max confidence among generic leaves
    normalizedSamples.forEach((s) => {
      const conf = Number(s.confidence ?? s.maxConfidence ?? s.highestConfidence ?? 0);
      if (conf > highestConfidence) {
        highestConfidence = conf;
      }
    });
  }

  const avgPositiveConfidence =
    positiveSamplesCount > 0 ? sumPositiveConf / positiveSamplesCount : 0;

  // 5. Average Visual Coverage across all submitted valid samples
  const totalVisualCoverage = normalizedSamples.reduce(
    (acc, s) => acc + Number(s.visualCoverage || 0),
    0
  );
  const avgVisualCoverage =
    totalValidSamples > 0 ? Number((totalVisualCoverage / totalValidSamples).toFixed(1)) : 0;

  // 6. Disease Classification across samples
  const diseaseTally = {};
  positiveSamples.forEach((s) => {
    const disName = s.primaryDisease || "Disease Indicator";
    if (!diseaseTally[disName]) {
      diseaseTally[disName] = { name: disName, count: 0, maxConf: 0, crop: s.crop || crop };
    }
    diseaseTally[disName].count += 1;
    const conf = Number(s.confidence ?? s.maxConfidence ?? s.highestConfidence ?? 0);
    if (conf > diseaseTally[disName].maxConf) {
      diseaseTally[disName].maxConf = conf;
    }
  });

  const detectedDiseases = Object.values(diseaseTally).sort(
    (a, b) => b.count - a.count || b.maxConf - a.maxConf
  );
  const dominantDisease = detectedDiseases[0]?.name || null;
  const dominantCrop = crop && crop !== "Crop" ? crop : (detectedDiseases[0]?.crop || "Crop");

  // 7. Visual Disease Concern & Combined Evidence Score (Visual index only)
  // Deterministic formula combining sample positive proportion, average positive confidence, and average visual coverage
  let fieldDiseaseBurdenScore = 0;
  let conditionKey = "low";
  let conditionLabel = "NO DISEASE-SPECIFIC INDICATOR DETECTED";
  let fieldVisualConcern = "NO DISEASE-SPECIFIC INDICATOR DETECTED";

  if (positiveSamplesCount === 0) {
    fieldDiseaseBurdenScore = 0;
    conditionKey = "low";
    conditionLabel = "NO DISEASE-SPECIFIC INDICATOR DETECTED";
    fieldVisualConcern = "NO DISEASE-SPECIFIC INDICATOR DETECTED";
  } else {
    const rawBurden =
      0.50 * (positiveRatio * 100) +
      0.30 * (avgPositiveConfidence * 100) +
      0.20 * avgVisualCoverage;
    fieldDiseaseBurdenScore = Math.min(100, Math.max(1, Math.round(rawBurden)));

    if (fieldDiseaseBurdenScore <= 25) {
      conditionKey = "low";
      conditionLabel = "LOW VISUAL DISEASE CONCERN";
      fieldVisualConcern = "LOW VISUAL DISEASE CONCERN";
    } else if (fieldDiseaseBurdenScore <= 50) {
      conditionKey = "medium";
      conditionLabel = "REVIEW REQUIRED";
      fieldVisualConcern = "MODERATE VISUAL DISEASE CONCERN";
    } else if (fieldDiseaseBurdenScore <= 75) {
      conditionKey = "high";
      conditionLabel = "HIGH VISUAL DISEASE CONCERN";
      fieldVisualConcern = "HIGH VISUAL DISEASE CONCERN";
    } else {
      conditionKey = "critical";
      conditionLabel = "CRITICAL VISUAL DISEASE CONCERN";
      fieldVisualConcern = "CRITICAL VISUAL DISEASE CONCERN";
    }

    // Confidence Safeguard: if strongest detection confidence is < 0.50, moderate the concern
    if (highestConfidence < 0.50 && (conditionKey === "critical" || conditionKey === "high")) {
      conditionKey = "medium";
      conditionLabel = "REVIEW REQUIRED";
      fieldVisualConcern = "MODERATE VISUAL DISEASE CONCERN (LOW CONFIDENCE)";
    }
  }

  // 8. Sampling Representation Context & Disclaimer (Acreage is context only)
  const numericAcreage = Number(fieldArea) || 1;
  const samplingRepresentation = getSamplingRepresentation(numericAcreage, totalValidSamples);

  let samplingAdequacyNote = "Assessment is based on the submitted representative samples.";
  if (numericAcreage > 5 && totalValidSamples <= 6) {
    samplingAdequacyNote =
      "Assessment is based on the submitted samples. Additional samples from different field sections may improve representativeness.";
  }

  const disclaimer =
    "This assessment is based on the submitted representative samples. It does not estimate the percentage of the entire field affected. Additional field sampling may be required for a more representative assessment.";

  // 9. Aggregate all individual detections for decision engine
  const allDiseaseDetections = normalizedSamples.flatMap(
    (s) => s.detections?.filter((d) => d.isDisease) || []
  );
  const allUnspecifiedLeafDetections = normalizedSamples.flatMap(
    (s) => s.detections?.filter((d) => !d.isDisease) || []
  );
  const allDetections = normalizedSamples.flatMap((s) => s.detections || []);

  const routingConfidence = getConfidenceCategory(highestConfidence);

  // 10. Farmer Operational Context Object
  const farmerContext = {
    crop: dominantCrop,
    fieldArea: numericAcreage,
    condition, // "fresh_market_grade" | "slightly_damaged" | "off_grade" | "surplus" | "other" | "unknown"
    materialType: materialState,
    burningRisk: burningContext,
    insuranceInterest: insuranceContext,
    feedRecoveryInterest: feedContext,
    communityExchangeInterest: communityContext,
    industrialProcessingInterest: industrialContext,
    problemDistribution, // "widespread" | "localized" | "unknown"
    damageLossDate,
    reportedDamageExtent,
    reportedPeril,
    lossTimeOfDay,
    sampledSections: sampledSections.length > 0 ? sampledSections : ["North", "East", "South", "West", "Centre"],
    samplingRepresentation
  };

  // 11. Visual Evidence structure for Decision Engine
  const visualEvidence = {
    cropName: dominantCrop,
    primaryDisease: dominantDisease,
    maxDetectionConfidence: Number(highestConfidence.toFixed(4)),
    aiConfidenceCategory: routingConfidence,
    visualCoverage: avgVisualCoverage,
    AIVisualDiseaseBurden: fieldDiseaseBurdenScore,
    burdenCategory: getBurdenCategory(fieldDiseaseBurdenScore),
    conditionKey,
    conditionLabel,
    diseaseDetections: allDiseaseDetections,
    unspecifiedLeafDetections: allUnspecifiedLeafDetections,
    totalDetections: allDetections,
    isMultiSample: true,
    totalValidSamples,
    positiveSamplesCount,
    healthySamplesCount,
    positiveZonesCount: positiveSamplesCount,
    healthyZonesCount: healthySamplesCount,
    avgPositiveConfidence: Number(avgPositiveConfidence.toFixed(4)),
    avgVisualCoverage,
    sampleConsistencyText,
    positiveZonesText,
    zoneEvidenceText,
    fieldVisualConcern,
    samplingRepresentation,
    disclaimer
  };

  // 12. Evaluate rescue pathways deterministically
  const rescueDecision = evaluateRescuePathway(visualEvidence, farmerContext);

  const usableEstimatedScore = Math.max(0, 100 - fieldDiseaseBurdenScore);

  return {
    isAdequate: true,
    cropName: dominantCrop,
    fieldArea: numericAcreage,
    condition: conditionKey,
    conditionLabel,
    fieldVisualConcern,
    damagePercentage: fieldDiseaseBurdenScore, // for backward compatibility in mockApi
    usablePercentage: usableEstimatedScore,
    diseaseBurdenScore: fieldDiseaseBurdenScore,
    visualCoverage: avgVisualCoverage,
    maxDetectionConfidence: Number(highestConfidence.toFixed(4)),
    highestConfidence: Number(highestConfidence.toFixed(4)),
    avgPositiveConfidence: Number(avgPositiveConfidence.toFixed(4)),
    burdenCategory: getBurdenCategory(fieldDiseaseBurdenScore),
    routingConfidence: rescueDecision.routingConfidence,
    totalValidSamples,
    positiveSamplesCount,
    positiveSampleCount: positiveSamplesCount, // alias for consistency
    healthySamplesCount,
    positiveZonesCount: positiveSamplesCount,
    healthyZonesCount: healthySamplesCount,
    positiveZonesText,
    zoneEvidenceText,
    sampleConsistencyText,
    samplingRepresentation,
    zoneResults,
    detectedDiseases,
    primaryDisease: dominantDisease,
    dominantDisease,
    samplingAdequacyNote,
    disclaimer,
    farmerContext,
    visualEvidence,
    farmerReported: {
      crop: dominantCrop,
      acres: numericAcreage,
      condition,
      materialState,
      reportedDamageExtent,
      reportedPeril,
      damageLossDate,
      lossTimeOfDay,
      problemDistribution,
      insuranceClaimIntent: insuranceContext
    },
    problemDistribution,
    damageLossDate,
    lossTimeOfDay,
    reportedDamageExtent,
    reportedPeril,
    claimWindowStatus: rescueDecision.claimWindowStatus,
    claimRoutingPriority: rescueDecision.claimRoutingPriority,
    claimRoutingReason: rescueDecision.claimRoutingReason,
    isPriorityPath: rescueDecision.isPriorityPath,
    sampledSections: farmerContext.sampledSections,
    fieldOverviewPhoto,
    samples: normalizedSamples,
    finalRecommendation: rescueDecision.primaryPathway,
    rescueDecision,
    safetyNote: rescueDecision.safetyNote,
    missingContextNotice: rescueDecision.missingContextNotice,
    alternatives: rescueDecision.alternatives,
    allPathways: rescueDecision.allPathways || Object.values(rescueDecision.pathwayEvaluations || {}),
    pathwayEvaluations: rescueDecision.pathwayEvaluations,
    pathwayScores: rescueDecision.pathwayScores,
    date: new Date().toISOString().split("T")[0]
  };
}
