/**
 * AgroCycle Crop Rescue Decision Engine
 *
 * Intelligently evaluates visual evidence from YOLO11n AI scans and farmer/operational context
 * to recommend one of the five existing AgroCycle rescue pathways:
 * 1. AgroConnect Community
 * 2. Urban Waste Matcher
 * 3. Silage Bank Network
 * 4. Claim Rocket
 * 5. Carbon Cash
 */

import { isLocalizedOrPostHarvestPeril, APPLICABLE_INTIMATION_WINDOW_HOURS } from "./claimRocketService.js";

export const PATHWAY_NAMES = {
  AGRO_CONNECT: "AgroConnect Community",
  URBAN_WASTE_MATCHER: "Urban Waste Matcher",
  SILAGE_BANK: "Silage Bank Network",
  CLAIM_ROCKET: "Claim Rocket",
  CARBON_CASH: "Carbon Cash"
};

export const PATHWAY_ROUTES = {
  [PATHWAY_NAMES.AGRO_CONNECT]: "/agro-connect",
  [PATHWAY_NAMES.URBAN_WASTE_MATCHER]: "/waste-market",
  [PATHWAY_NAMES.SILAGE_BANK]: "/silage-bank",
  [PATHWAY_NAMES.CLAIM_ROCKET]: "/claim-rocket",
  [PATHWAY_NAMES.CARBON_CASH]: "/carbon-cash"
};

/**
 * Evaluates all 5 rescue pathways based on Visual Evidence & Farmer Context.
 *
 * @param {Object} visualEvidence
 * @param {string} visualEvidence.cropName - Crop name (e.g. Potato, Tomato, Corn, Grape, Soybean)
 * @param {string|null} visualEvidence.primaryDisease - Name of strongest disease or null
 * @param {number} visualEvidence.maxDetectionConfidence - 0.0 to 1.0
 * @param {string} visualEvidence.aiConfidenceCategory - "Low" | "Moderate" | "High"
 * @param {number} visualEvidence.visualCoverage - 0.0 to 100.0 (%)
 * @param {number} visualEvidence.AIVisualDiseaseBurden - 0 to 100
 * @param {string} visualEvidence.burdenCategory - Category of burden
 * @param {string} visualEvidence.conditionKey - "low" | "medium" | "high" | "critical"
 * @param {string} visualEvidence.conditionLabel - Condition label
 * @param {Array} visualEvidence.diseaseDetections - Array of disease detections
 * @param {Array} visualEvidence.unspecifiedLeafDetections - Array of generic leaf detections
 * @param {Array} visualEvidence.totalDetections - Total detections list
 *
 * @param {Object} [farmerContext={}]
 * @param {string} [farmerContext.materialType="unknown"] - "standing_crop" | "crop_residue" | "fodder" | "manure" | "agricultural_surplus" | "damaged_produce" | "unknown"
 * @param {string} [farmerContext.burningRisk="unknown"] - "yes" | "no" | "unknown"
 * @param {string} [farmerContext.insuranceInterest="unknown"] - "yes" | "no" | "unknown"
 * @param {string} [farmerContext.feedRecoveryInterest="unknown"] - "yes" | "no" | "unknown"
 * @param {string} [farmerContext.communityExchangeInterest="unknown"] - "yes" | "no" | "unknown"
 * @param {string} [farmerContext.industrialProcessingInterest="unknown"] - "yes" | "no" | "unknown"
 */
export function evaluateRescuePathway(visualEvidence, farmerContext = {}) {
  const {
    cropName = "Crop",
    primaryDisease = null,
    maxDetectionConfidence = 0,
    aiConfidenceCategory = "Moderate",
    visualCoverage = 0,
    AIVisualDiseaseBurden = 0,
    diseaseDetections = [],
    unspecifiedLeafDetections = []
  } = visualEvidence || {};

  const context = {
    materialType: farmerContext?.materialType || "unknown",
    burningRisk: farmerContext?.burningRisk || "unknown",
    insuranceInterest: farmerContext?.insuranceInterest || "unknown",
    feedRecoveryInterest: farmerContext?.feedRecoveryInterest || "unknown",
    communityExchangeInterest: farmerContext?.communityExchangeInterest || "unknown",
    industrialProcessingInterest: farmerContext?.industrialProcessingInterest || "unknown",
    condition: farmerContext?.condition || "unknown",
    problemDistribution: farmerContext?.problemDistribution || "unknown",
    damageLossDate: farmerContext?.damageLossDate || null,
    reportedDamageExtent: farmerContext?.reportedDamageExtent || "not_sure",
    reportedPeril: farmerContext?.reportedPeril || farmerContext?.damageType || null,
    lossTimeOfDay: farmerContext?.lossTimeOfDay || "unknown",
    sampledSections: farmerContext?.sampledSections || [],
    fieldArea: farmerContext?.fieldArea || 1
  };

  const hasDisease = diseaseDetections.length > 0 || AIVisualDiseaseBurden > 0;
  const isGenericLeafOnly = !hasDisease && unspecifiedLeafDetections.length > 0;
  const noDetections = !hasDisease && unspecifiedLeafDetections.length === 0;

  // Determine whether the reported peril or context belongs to a PMFBY localized calamity / post-harvest loss
  const isLocalized = isLocalizedOrPostHarvestPeril(context.reportedPeril);
  let claimWindowStatus = "not_applicable";
  let elapsedLossHours = null;

  if (context.insuranceInterest === "yes" && isLocalized) {
    if (context.damageLossDate) {
      try {
        const lossDateObj = new Date(context.damageLossDate);
        if (!isNaN(lossDateObj.getTime())) {
          const now = Date.now();
          const diffMs = now - lossDateObj.getTime();
          elapsedLossHours = Math.max(0, Number((diffMs / (1000 * 60 * 60)).toFixed(1)));
          if (elapsedLossHours <= APPLICABLE_INTIMATION_WINDOW_HOURS) {
            claimWindowStatus = "within_window";
          } else {
            claimWindowStatus = "outside_window";
          }
        } else {
          claimWindowStatus = "unknown";
        }
      } catch (e) {
        claimWindowStatus = "unknown";
      }
    } else {
      claimWindowStatus = "unknown";
    }
  }

  // Initialize pathway evaluations
  const evaluations = {};

  // -------------------------------------------------------------
  // 1. SILAGE BANK NETWORK EVALUATION
  // -------------------------------------------------------------
  if (hasDisease) {
    // STRICT SAFETY RULE: Disease detection disqualifies animal feed.
    evaluations[PATHWAY_NAMES.SILAGE_BANK] = {
      feature: PATHWAY_NAMES.SILAGE_BANK,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.SILAGE_BANK],
      status: "not eligible",
      score: 0,
      action: "Animal Feed Conversion Ineligible",
      reason: "Disease-specific visual indicators detected. Feed conversion cannot be recommended.",
      safetyRestriction: "Diseased material must not be assumed safe for livestock feed.",
      missingContext: null,
      disclaimer: "Diseased material must not be assumed safe for livestock feed."
    };
  } else {
    // Clean foliage / residue
    let silageScore = 20;
    let silageStatus = "conditional";
    let silageReason = "No disease-specific visual indicators detected. Material may be evaluated for feed suitability.";
    let silageMissing = "Feed-resource suitability and livestock feed recovery interest must be confirmed.";

    if (context.feedRecoveryInterest === "yes") {
      silageScore = 92;
      silageStatus = "recommended";
      silageReason = "Clean crop material with confirmed feed-resource recovery intent. Suitable for silage conversion evaluation.";
      silageMissing = null;
    } else if (context.feedRecoveryInterest === "no") {
      silageScore = 5;
      silageStatus = "not eligible";
      silageReason = "Feed recovery not requested by farmer.";
      silageMissing = null;
    } else if (context.burningRisk === "yes") {
      silageScore = 40;
      silageStatus = "conditional";
      silageReason = "Clean material with active burning risk. Silage recovery is conditional if not diverted for composting/biochar.";
      silageMissing = "Confirmation needed if farmer prefers livestock feed conversion over carbon incentives.";
    } else if (context.materialType === "fodder" || context.materialType === "crop_residue") {
      silageScore = 82;
      silageStatus = "recommended";
      silageReason = "Clean crop material with residue/fodder context. Suitable for feed-resource evaluation.";
      silageMissing = null;
    }

    evaluations[PATHWAY_NAMES.SILAGE_BANK] = {
      feature: PATHWAY_NAMES.SILAGE_BANK,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.SILAGE_BANK],
      status: silageStatus,
      score: silageScore,
      action: "Feed-Resource Evaluation & Silage Conversion Assessment",
      reason: silageReason,
      safetyRestriction: null,
      missingContext: silageMissing,
      disclaimer: "Material may be suitable for feed-resource recovery; final feed safety assessment is required."
    };
  }

  // -------------------------------------------------------------
  // 2. CLAIM ROCKET EVALUATION
  // -------------------------------------------------------------
  const isSubstantialDamage = AIVisualDiseaseBurden >= 40 || (hasDisease && maxDetectionConfidence >= 0.70);
  const isReportedFullyDamaged = context.reportedDamageExtent === "entire_field" || 
    context.reportedDamageExtent === "entire_field_fully_damaged" || 
    context.reportedDamageExtent === "Entire field / fully damaged";

  if (context.insuranceInterest === "no") {
    evaluations[PATHWAY_NAMES.CLAIM_ROCKET] = {
      feature: PATHWAY_NAMES.CLAIM_ROCKET,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.CLAIM_ROCKET],
      status: "not eligible",
      score: 10,
      priority: "not_applicable",
      claimWindowStatus: "not_applicable",
      claimRoutingPriority: "not_applicable",
      claimRoutingReason: "Farmer indicated no active insurance policy or loss claim consideration.",
      action: "Insurance Assessment Inactive",
      reason: "Farmer indicated no active insurance policy or loss claim consideration.",
      safetyRestriction: null,
      missingContext: null,
      disclaimer: "Potential insurance-loss assessment recommended; does not guarantee policy claim eligibility or approval."
    };
  } else if (context.insuranceInterest === "yes") {
    if (isLocalized) {
      if (claimWindowStatus === "within_window") {
        // PRIORITY PATH: Within 72h window for localized calamity and insurance requested
        evaluations[PATHWAY_NAMES.CLAIM_ROCKET] = {
          feature: PATHWAY_NAMES.CLAIM_ROCKET,
          route: PATHWAY_ROUTES[PATHWAY_NAMES.CLAIM_ROCKET],
          status: "recommended",
          priority: "priority",
          isPriorityPath: true,
          priorityTitle: "CLAIM ROCKET — PRIORITY PATH",
          score: 98,
          claimWindowStatus: "within_window",
          claimRoutingPriority: "priority",
          claimRoutingReason: "Reported loss is within the applicable 72-hour intimation window.",
          elapsedLossHours,
          action: "Start Claim Rocket →",
          reason: "Your crop has been reported as fully damaged and the reported loss is within the applicable loss-intimation window. We recommend starting Claim Rocket now so you can prepare the required information and evidence for official loss intimation.",
          safetyRestriction: null,
          missingContext: null,
          disclaimer: "Potential insurance-loss assessment recommended; does not guarantee policy claim eligibility or approval."
        };
      } else if (claimWindowStatus === "outside_window") {
        // OUTSIDE 72h WINDOW: Still available, help organize evidence and guide to official channel
        evaluations[PATHWAY_NAMES.CLAIM_ROCKET] = {
          feature: PATHWAY_NAMES.CLAIM_ROCKET,
          route: PATHWAY_ROUTES[PATHWAY_NAMES.CLAIM_ROCKET],
          status: "recommended",
          priority: "standard",
          isPriorityPath: false,
          priorityTitle: "CLAIM ROCKET",
          score: 88,
          claimWindowStatus: "outside_window",
          claimRoutingPriority: "standard",
          claimRoutingReason: "The reported loss occurred outside the applicable 72-hour intimation window.",
          elapsedLossHours,
          action: "Continue to Claim Rocket →",
          reason: "The reported loss occurred outside the applicable 72-hour intimation window. AgroCycle can still help you organize your evidence, review the information required, and guide you to the appropriate official channel.",
          safetyRestriction: null,
          missingContext: null,
          disclaimer: "Potential insurance-loss assessment recommended; does not guarantee policy claim eligibility or approval."
        };
      } else {
        // Loss date missing/unknown for localized calamity: Do NOT assume 72h window
        evaluations[PATHWAY_NAMES.CLAIM_ROCKET] = {
          feature: PATHWAY_NAMES.CLAIM_ROCKET,
          route: PATHWAY_ROUTES[PATHWAY_NAMES.CLAIM_ROCKET],
          status: "conditional",
          priority: "standard",
          isPriorityPath: false,
          priorityTitle: "CLAIM ROCKET",
          score: 78,
          claimWindowStatus: "unknown",
          claimRoutingPriority: "standard",
          claimRoutingReason: "Damage/loss date not provided; loss-intimation deadline cannot be determined without loss date.",
          elapsedLossHours: null,
          action: "Add Loss Date",
          reason: "Claim Rocket may be relevant. Please provide the damage/loss date to determine whether prompt loss intimation may apply.",
          safetyRestriction: null,
          missingContext: "Please provide the damage/loss date to determine whether prompt loss intimation may apply.",
          disclaimer: "Potential insurance-loss assessment recommended; does not guarantee policy claim eligibility or approval."
        };
      }
    } else {
      // Pest / Disease or wide-area claim with Insurance = YES: Claim Rocket available, no 72h constraint
      evaluations[PATHWAY_NAMES.CLAIM_ROCKET] = {
        feature: PATHWAY_NAMES.CLAIM_ROCKET,
        route: PATHWAY_ROUTES[PATHWAY_NAMES.CLAIM_ROCKET],
        status: "recommended",
        priority: "standard",
        isPriorityPath: false,
        priorityTitle: "CLAIM ROCKET",
        score: 88,
        claimWindowStatus: "not_applicable",
        claimRoutingPriority: "standard",
        claimRoutingReason: "Loss involves pest/disease or wide-area claim documentation.",
        elapsedLossHours: null,
        action: "Continue to Claim Rocket →",
        reason: "Your reported loss involves pest/disease. Claim Rocket will help you organize the required information and evidence and guide you through the applicable PMFBY claim process.",
        safetyRestriction: null,
        missingContext: null,
        disclaimer: "Potential insurance-loss assessment recommended; does not guarantee policy claim eligibility or approval."
      };
    }
  } else {
    // context.insuranceInterest is unknown
    if (isSubstantialDamage) {
      const claimScore = Math.min(65, Math.round(30 + AIVisualDiseaseBurden * 0.35));
      evaluations[PATHWAY_NAMES.CLAIM_ROCKET] = {
        feature: PATHWAY_NAMES.CLAIM_ROCKET,
        route: PATHWAY_ROUTES[PATHWAY_NAMES.CLAIM_ROCKET],
        status: "conditional",
        priority: "standard",
        isPriorityPath: false,
        score: claimScore,
        claimWindowStatus: "unknown",
        claimRoutingPriority: "standard",
        claimRoutingReason: "Significant visual disease burden detected without explicit insurance context.",
        action: "Crop Damage Assessment & Insurance-Loss Filing Evaluation",
        reason: `Significant visual disease burden (${AIVisualDiseaseBurden}/100) detected. Potential insurance-loss assessment recommended if crop is covered.`,
        safetyRestriction: null,
        missingContext: "Active insurance policy coverage and insurance-loss claim consideration context required.",
        disclaimer: "Potential insurance-loss assessment recommended; does not guarantee policy claim eligibility or approval."
      };
    } else {
      evaluations[PATHWAY_NAMES.CLAIM_ROCKET] = {
        feature: PATHWAY_NAMES.CLAIM_ROCKET,
        route: PATHWAY_ROUTES[PATHWAY_NAMES.CLAIM_ROCKET],
        status: "not eligible",
        priority: "not_applicable",
        isPriorityPath: false,
        score: 10,
        claimWindowStatus: "not_applicable",
        claimRoutingPriority: "not_applicable",
        action: "Insurance Assessment Inactive",
        reason: "Visual damage is below standard threshold for primary insurance routing.",
        safetyRestriction: null,
        missingContext: null,
        disclaimer: "Potential insurance-loss assessment recommended; does not guarantee policy claim eligibility or approval."
      };
    }
  }

  // -------------------------------------------------------------
  // 3. CARBON CASH EVALUATION
  // -------------------------------------------------------------
  if (context.burningRisk === "yes") {
    const carbonScore = Math.min(95, Math.round(82 + AIVisualDiseaseBurden * 0.15));
    evaluations[PATHWAY_NAMES.CARBON_CASH] = {
      feature: PATHWAY_NAMES.CARBON_CASH,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.CARBON_CASH],
      status: "recommended",
      score: carbonScore,
      action: "Sustainable-Waste Diversion & Composting/Biochar Verification",
      reason: "Active burning risk identified. Sustainable diversion through controlled composting or biochar is recommended for carbon incentives.",
      safetyRestriction: null,
      missingContext: null,
      disclaimer: "Potential sustainable-waste diversion opportunity. Consider eligible alternatives to crop-residue burning."
    };
  } else if (context.burningRisk === "no") {
    evaluations[PATHWAY_NAMES.CARBON_CASH] = {
      feature: PATHWAY_NAMES.CARBON_CASH,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.CARBON_CASH],
      status: "conditional",
      score: 25,
      action: "General Eco-Waste Management",
      reason: "No immediate burning risk reported. Material can still be evaluated for standard organic soil enhancement.",
      safetyRestriction: null,
      missingContext: null,
      disclaimer: "Potential sustainable-waste diversion opportunity. Consider eligible alternatives to crop-residue burning."
    };
  } else {
    // context is unknown
    const isHighBiomassOrSevere = AIVisualDiseaseBurden >= 50 || context.materialType === "crop_residue" || context.materialType === "damaged_produce";
    const carbonScore = isHighBiomassOrSevere ? Math.min(70, Math.round(30 + AIVisualDiseaseBurden * 0.35)) : 20;

    evaluations[PATHWAY_NAMES.CARBON_CASH] = {
      feature: PATHWAY_NAMES.CARBON_CASH,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.CARBON_CASH],
      status: isHighBiomassOrSevere ? "conditional" : "not eligible",
      score: carbonScore,
      action: "Sustainable-Waste Diversion & Composting/Biochar Verification",
      reason: isHighBiomassOrSevere
        ? "Material condition suggests potential waste diversion opportunity if field burning would otherwise occur."
        : "No immediate field-burning risk indicated from current visual scan.",
      safetyRestriction: null,
      missingContext: "Confirmation needed if material is at risk of field burning or eligible for sustainable composting/biochar incentives.",
      disclaimer: "Potential sustainable-waste diversion opportunity. Consider eligible alternatives to crop-residue burning."
    };
  }

  // -------------------------------------------------------------
  // 4. AGROCONNECT COMMUNITY EVALUATION
  // -------------------------------------------------------------
  if (hasDisease && AIVisualDiseaseBurden > 25) {
    // Heavily penalize diseased crop from community exchange to avoid spreading pathogens
    evaluations[PATHWAY_NAMES.AGRO_CONNECT] = {
      feature: PATHWAY_NAMES.AGRO_CONNECT,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.AGRO_CONNECT],
      status: "not eligible",
      score: Math.max(5, 30 - AIVisualDiseaseBurden),
      action: "Community Exchange Ineligible",
      reason: "Active disease-specific visual indicators detected. Sharing diseased material across the farming community risks pathogen dissemination.",
      safetyRestriction: "Infected crop material should not be exchanged with other farms to prevent disease spread.",
      missingContext: null,
      disclaimer: "Material may have value as an agricultural resource for community exchange."
    };
  } else if (context.communityExchangeInterest === "no") {
    evaluations[PATHWAY_NAMES.AGRO_CONNECT] = {
      feature: PATHWAY_NAMES.AGRO_CONNECT,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.AGRO_CONNECT],
      status: "not eligible",
      score: 5,
      action: "Community Exchange Inactive",
      reason: "Farmer indicated no interest in community exchange.",
      safetyRestriction: null,
      missingContext: null,
      disclaimer: "Material may have value as an agricultural resource for community exchange."
    };
  } else if (context.communityExchangeInterest === "yes") {
    const agroScore = hasDisease ? 45 : 92;
    evaluations[PATHWAY_NAMES.AGRO_CONNECT] = {
      feature: PATHWAY_NAMES.AGRO_CONNECT,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.AGRO_CONNECT],
      status: "recommended",
      score: agroScore,
      action: "Community Waste/Residue Exchange & Local Resource Sharing",
      reason: "Confirmed community exchange intent. Material suitable for local farmer resource sharing.",
      safetyRestriction: hasDisease ? "Minor visual symptoms detected. Agronomic check advised prior to exchange." : null,
      missingContext: null,
      disclaimer: "Material may have value as an agricultural resource for community exchange."
    };
  } else if (["crop_residue", "fodder", "manure", "agricultural_surplus"].includes(context.materialType)) {
    const agroScore = hasDisease ? 40 : (context.burningRisk === "yes" ? 70 : (context.feedRecoveryInterest === "yes" ? 75 : 85));
    evaluations[PATHWAY_NAMES.AGRO_CONNECT] = {
      feature: PATHWAY_NAMES.AGRO_CONNECT,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.AGRO_CONNECT],
      status: "recommended",
      score: agroScore,
      action: "Community Waste/Residue Exchange & Local Resource Sharing",
      reason: "Material appears suitable for community resource sharing and localized agricultural exchange.",
      safetyRestriction: hasDisease ? "Minor visual symptoms detected. Agronomic check advised prior to exchange." : null,
      missingContext: null,
      disclaimer: "Material may have value as an agricultural resource for community exchange."
    };
  } else if (!hasDisease) {
    // Clean leaf / generic scan with unknown context
    evaluations[PATHWAY_NAMES.AGRO_CONNECT] = {
      feature: PATHWAY_NAMES.AGRO_CONNECT,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.AGRO_CONNECT],
      status: "recommended",
      score: 75,
      action: "Direct Field Monitoring & Community Sharing Evaluation",
      reason: "No disease-specific visual indicator detected on foliage. Suitable for community resource exchange or routine agronomic monitoring.",
      safetyRestriction: null,
      missingContext: "Community sharing intent or agricultural surplus/residue availability context can be specified.",
      disclaimer: "Material may have value as an agricultural resource for community exchange."
    };
  } else {
    evaluations[PATHWAY_NAMES.AGRO_CONNECT] = {
      feature: PATHWAY_NAMES.AGRO_CONNECT,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.AGRO_CONNECT],
      status: "conditional",
      score: 30,
      action: "Community Exchange Evaluation",
      reason: "Visual symptoms present; community exchange requires careful segregation.",
      safetyRestriction: "Ensure material is isolated from healthy fields.",
      missingContext: "Community exchange interest context required.",
      disclaimer: "Material may have value as an agricultural resource for community exchange."
    };
  }

  // -------------------------------------------------------------
  // 5. URBAN WASTE MATCHER EVALUATION
  // Default non-food recovery assessment pathway for damaged/excess material
  // when other pathway context is unavailable.
  // -------------------------------------------------------------
  if (hasDisease) {
    let wasteScore = 80;
    let wasteStatus = "recommended";
    let wasteReason = "Default non-food recovery assessment pathway for damaged/excess material when other pathway context is unavailable.";

    if (context.industrialProcessingInterest === "yes") {
      wasteScore = 90;
      wasteReason = "Confirmed industrial/processing sale interest. Material suitable for non-food off-take evaluation.";
    } else if (context.insuranceInterest === "yes" || context.burningRisk === "yes") {
      // If higher-priority specific context is confirmed, waste matcher becomes a strong alternative
      wasteScore = 70;
      wasteStatus = "conditional";
    }

    evaluations[PATHWAY_NAMES.URBAN_WASTE_MATCHER] = {
      feature: PATHWAY_NAMES.URBAN_WASTE_MATCHER,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.URBAN_WASTE_MATCHER],
      status: wasteStatus,
      score: wasteScore,
      action: "Resource Recovery Assessment & Industrial/Processing Evaluation",
      reason: wasteReason,
      safetyRestriction: "Diseased material must not be assumed safe for livestock feed or direct food consumption.",
      missingContext: context.industrialProcessingInterest === "unknown"
        ? "Specify buyer/processing preferences (biofuel, starch, composting, industrial) to refine matching."
        : null,
      disclaimer: "Actual suitability depends on material type, buyer requirements, processing eligibility, and operational context."
    };
  } else {
    // No disease
    let wasteScore = 30;
    let wasteStatus = "conditional";
    let wasteReason = "No disease-specific damage detected. Non-food industrial sale is optional if commercial surplus exists.";

    if (context.industrialProcessingInterest === "yes" || context.materialType === "damaged_produce" || context.materialType === "agricultural_surplus") {
      wasteScore = 80;
      wasteStatus = "recommended";
      wasteReason = "Commercial surplus/material available for industrial/processing off-take matching.";
    }

    evaluations[PATHWAY_NAMES.URBAN_WASTE_MATCHER] = {
      feature: PATHWAY_NAMES.URBAN_WASTE_MATCHER,
      route: PATHWAY_ROUTES[PATHWAY_NAMES.URBAN_WASTE_MATCHER],
      status: wasteStatus,
      score: wasteScore,
      action: "Surplus Off-Take & Processing Matcher Assessment",
      reason: wasteReason,
      safetyRestriction: null,
      missingContext: "Specify surplus volume or buyer preferences to activate commercial matching.",
      disclaimer: "Actual suitability depends on material type, buyer requirements, processing eligibility, and operational context."
    };
  }

  // -------------------------------------------------------------
  // RANKING & PRIMARY / ALTERNATIVE SELECTION
  // -------------------------------------------------------------
  const allPathways = Object.values(evaluations);

  // Sort descending by score
  allPathways.sort((a, b) => b.score - a.score);

  const primary = allPathways[0];

  // Derive Routing Confidence (Independent of YOLO detection confidence)
  // Depends on score margin and whether context is confirmed vs unknown
  let routingConfidence = "Moderate";
  const scoreMargin = primary.score - (allPathways[1]?.score || 0);

  if (primary.status === "recommended") {
    if (scoreMargin >= 20 || (primary.score >= 85 && maxDetectionConfidence >= 0.60)) {
      routingConfidence = "High";
    } else if (scoreMargin >= 10) {
      routingConfidence = "Moderate";
    } else {
      routingConfidence = "Moderate";
    }
  } else if (primary.status === "conditional") {
    routingConfidence = "Moderate";
  } else {
    routingConfidence = "Low";
  }

  // Find valid alternatives (score >= 35, distinct from primary, and status !== "not eligible")
  const alternatives = allPathways
    .slice(1)
    .filter(p => p.score >= 35 && p.status !== "not eligible" && p.feature !== primary.feature)
    .map(p => ({
      feature: p.feature,
      route: p.route,
      status: p.status,
      score: p.score,
      action: p.action,
      reason: p.reason,
      routingConfidence: p.score >= 70 ? "Moderate" : "Low",
      disclaimer: p.disclaimer,
      missingContext: p.missingContext
    }));

  // Construct structured result
  return {
    primaryPathway: {
      feature: primary.feature,
      featureId: primary.feature,
      route: primary.route,
      status: primary.status,
      priority: primary.priority || "standard",
      isPriorityPath: Boolean(primary.isPriorityPath),
      priorityTitle: primary.priorityTitle || primary.feature,
      score: primary.score,
      action: primary.action,
      reason: primary.reason,
      claimWindowStatus: primary.claimWindowStatus || claimWindowStatus,
      claimRoutingPriority: primary.claimRoutingPriority || "not_applicable",
      claimRoutingReason: primary.claimRoutingReason || null,
      elapsedLossHours: primary.elapsedLossHours !== undefined ? primary.elapsedLossHours : elapsedLossHours,
      confidence: routingConfidence,
      routingConfidence: routingConfidence,
      disclaimer: primary.disclaimer
    },
    routingConfidence,
    suggestedAction: primary.action,
    reason: primary.reason,
    claimWindowStatus: evaluations[PATHWAY_NAMES.CLAIM_ROCKET]?.claimWindowStatus || claimWindowStatus,
    claimRoutingPriority: evaluations[PATHWAY_NAMES.CLAIM_ROCKET]?.claimRoutingPriority || "not_applicable",
    claimRoutingReason: evaluations[PATHWAY_NAMES.CLAIM_ROCKET]?.claimRoutingReason || null,
    isPriorityPath: Boolean(primary.isPriorityPath),
    safetyNote: primary.safetyRestriction || (hasDisease ? "Diseased material must not be assumed safe for livestock feed." : null),
    missingContextNotice: primary.missingContext,
    disclaimer: primary.disclaimer,
    alternatives,
    allPathways,
    pathwayEvaluations: evaluations,
    pathwayScores: {
      agroConnect: evaluations[PATHWAY_NAMES.AGRO_CONNECT]?.score || 0,
      urbanWasteMatcher: evaluations[PATHWAY_NAMES.URBAN_WASTE_MATCHER]?.score || 0,
      silageBank: evaluations[PATHWAY_NAMES.SILAGE_BANK]?.score || 0,
      claimRocket: evaluations[PATHWAY_NAMES.CLAIM_ROCKET]?.score || 0,
      carbonCash: evaluations[PATHWAY_NAMES.CARBON_CASH]?.score || 0
    },
    farmerContext: context
  };
}

