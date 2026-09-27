/**
 * Claim Rocket Service & PMFBY Calculation Engine
 * 
 * Provides pure utility functions for PMFBY intimation window assessment,
 * peril options, and local evidence compilation without React/JSX dependencies.
 */

export const OFFICIAL_PMFBY_PORTAL_URL = "https://pmfby.gov.in";
export const OFFICIAL_PMFBY_HELPLINE = "14447";
export const OFFICIAL_PMFBY_APP_URL = "https://play.google.com/store/apps/details?id=in.farmguide.farmerapp";
export const APPLICABLE_INTIMATION_WINDOW_HOURS = 72;

export const PERIL_OPTIONS = [
  { value: "hailstorm", label: "Hailstorm", isLocalized: true },
  { value: "landslide", label: "Landslide", isLocalized: true },
  { value: "flood", label: "Inundation / Flood", isLocalized: true },
  { value: "cloudburst", label: "Cloudburst", isLocalized: true },
  { value: "fire", label: "Natural Fire due to Lightning", isLocalized: true },
  { value: "cyclone", label: "Cyclone / Cyclonic Rain", isLocalized: true },
  { value: "unseasonal_rain", label: "Unseasonal Rain", isLocalized: true },
  { value: "drought", label: "Drought / Dry Spell", isLocalized: false },
  { value: "pest_disease", label: "Pest / Disease", isLocalized: false },
  { value: "other", label: "Other", isLocalized: false },
  { value: "not_sure", label: "Not Sure", isLocalized: false }
];

export const LOSS_TIME_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
  { value: "exact_time", label: "Exact Time" },
  { value: "unknown", label: "Unknown" }
];

export const SEASON_OPTIONS = [
  { value: "kharif", label: "Kharif (Monsoon Season)" },
  { value: "rabi", label: "Rabi (Winter Season)" },
  { value: "zaid", label: "Zaid (Summer Season)" },
  { value: "commercial", label: "Commercial / Horticultural (Annual)" }
];

export const LOSS_CATEGORY_OPTIONS = [
  { value: "localized", label: "Localized Calamity (Hailstorm, Landslide, Inundation, Cloudburst, Natural Fire)" },
  { value: "post_harvest", label: "Post-Harvest Loss (Cyclone, Unseasonal Rain up to 14 days after harvest)" },
  { value: "prevented_sowing", label: "Prevented Sowing / Planting Risk (Deficit rainfall)" },
  { value: "standing_crop", label: "Standing Crop Loss (Drought, Pest/Disease, Dry spells)" },
  { value: "mid_season", label: "Mid-Season Adversity (Severe weather causing >50% expected yield loss)" }
];

export const REPORTED_DAMAGE_EXTENT_OPTIONS = [
  { value: "entire_field", label: "Entire field / fully damaged" },
  { value: "more_than_half", label: "More than half" },
  { value: "less_than_half", label: "Less than half" },
  { value: "localized", label: "Localized area" },
  { value: "not_sure", label: "Not sure" }
];

/**
 * Checks if the reported peril is an applicable PMFBY localized calamity or specified post-harvest loss
 */
export function isLocalizedOrPostHarvestPeril(damageType) {
  if (!damageType) return false;
  const normalized = String(damageType).toLowerCase().trim();
  const localizedValues = ["hailstorm", "landslide", "flood", "cloudburst", "fire", "cyclone", "unseasonal_rain"];
  return localizedValues.includes(normalized);
}

/**
 * Maps legacy or alias peril keys to current options
 */
export function normalizePerilValue(damageType) {
  if (!damageType) return "pest_disease";
  const d = String(damageType).toLowerCase().trim();
  if (d === "disease" || d === "pest" || d === "crop pathological disease" || d === "pest_disease") return "pest_disease";
  if (d === "hailstorm") return "hailstorm";
  if (d === "landslide") return "landslide";
  if (d === "flood" || d === "inundation") return "flood";
  if (d === "cloudburst") return "cloudburst";
  if (d === "fire") return "fire";
  if (d === "cyclone") return "cyclone";
  if (d === "unseasonal_rain") return "unseasonal_rain";
  if (d === "drought") return "drought";
  if (d === "not_sure") return "not_sure";
  return "other";
}

/**
 * Evaluates local photographic evidence and farmer-reported damage context
 * against PMFBY guidelines.
 */
export function calculateLocalEvidenceReview({ 
  cropType, 
  damageType, 
  areaAcres, 
  location, 
  hasImage, 
  incidentDate,
  lossTimeOfDay = "unknown",
  reportedDamageExtent,
  visualEvidence
}) {
  const normalizedPeril = normalizePerilValue(damageType);
  const perilObj = PERIL_OPTIONS.find(p => p.value === normalizedPeril);
  const perilName = perilObj ? perilObj.label : (damageType || "Pest / Disease");
  const isLocalized = isLocalizedOrPostHarvestPeril(normalizedPeril);
  const today = new Date().toISOString().split("T")[0];

  let windowStatus = "not_applicable";
  let windowStatusBadge = null;
  let elapsedHours = null;
  let nextStepTitle = "";
  let nextStepDesc = "";
  let recommendation = "";
  let windowMessage = "";

  if (isLocalized) {
    nextStepTitle = "NEXT STEP: REPORT LOSS THROUGH OFFICIAL CHANNEL";
    nextStepDesc = "For applicable localized calamities and specified post-harvest losses, PMFBY guidelines provide for loss intimation within 72 hours of occurrence. Report the loss through an official channel as soon as possible.";

    if (incidentDate) {
      const lossTime = new Date(incidentDate).getTime();
      const nowTime = Date.now();
      if (!isNaN(lossTime)) {
        elapsedHours = Math.max(0, (nowTime - lossTime) / (1000 * 60 * 60));
        if (elapsedHours <= APPLICABLE_INTIMATION_WINDOW_HOURS) {
          windowStatus = "within_window";
          windowStatusBadge = (lossTimeOfDay === "exact_time") ? "Within 72h Window" : "72-hour status: Approximate";
          windowMessage = "For applicable localized calamities and specified post-harvest losses, PMFBY guidelines provide for loss intimation within 72 hours of occurrence. Report the loss through an official channel as soon as possible.";
          recommendation = "Intimate loss details immediately on the PMFBY portal or toll-free helpline 14447 within 72 hours. Retain geo-tagged photographs for joint field survey.";
        } else {
          windowStatus = "outside_window";
          windowStatusBadge = "Outside 72h Window";
          windowMessage = "The reported loss occurred outside the applicable 72-hour intimation window. Submit the prepared dossier to your bank, CSC, or agriculture department.";
          recommendation = "Submit prepared claim preparation dossier and photographic evidence through your bank branch, CSC center, or district agriculture officer.";
        }
      }
    } else {
      windowStatus = "unknown";
      windowStatusBadge = "Loss Date Required";
      windowMessage = "Please provide the damage/loss date to determine whether prompt loss intimation may apply.";
      nextStepDesc = "Please provide the damage/loss date to determine whether prompt loss intimation may apply.";
      recommendation = "Please provide the damage/loss date to determine whether prompt loss intimation may apply.";
    }
  } else {
    // Pest / Disease or Non-localized
    nextStepTitle = "NEXT STEP: PREPARE YOUR INSURANCE CLAIM";
    nextStepDesc = "Your reported loss involves pest/disease. Claim Rocket will help you organize the required information and evidence and guide you through the applicable PMFBY claim process.";
    windowStatus = "not_applicable";
    windowStatusBadge = null;
    windowMessage = "Your reported loss involves pest/disease. Claim Rocket will help you organize the required information and evidence and guide you through the applicable PMFBY claim process.";
    recommendation = "Claim Rocket will help you organize the required information and evidence and guide you through the applicable PMFBY claim process.";
  }

  const isFullLoss = reportedDamageExtent === "entire_field";

  return {
    image_quality: hasImage ? "adequate" : "needs_improvement",
    crop_visible: Boolean(hasImage),
    is_localized: isLocalized,
    window_status: windowStatus,
    window_status_badge: windowStatusBadge,
    window_message: windowMessage,
    elapsed_hours: elapsedHours,
    next_step_title: nextStepTitle,
    next_step_desc: nextStepDesc,
    damage_indicators: hasImage 
      ? `Preliminary damage documentation logged for ${cropType || "crop"} under ${perilName}.`
      : "No visual evidence attached yet. Photographic evidence is strongly recommended.",
    peril_consistency: `Reported peril: ${perilName}. Photographic evidence recorded for surveyor verification.`,
    reported_loss_summary: `Farmer reported ${isFullLoss ? "full crop loss (Entire field / fully damaged)" : (reportedDamageExtent || "crop damage")} on ${areaAcres || "unspecified"} acres.`,
    evidence_completeness: (hasImage && areaAcres && cropType) 
      ? "Sufficient for preliminary claim dossier preparation."
      : "Partial claim details. Additional field information recommended.",
    recommendation,
    disclaimer: "Visual AI observations are for photographic documentation assistance only and do NOT constitute an official insurance loss assessment, indemnity percentage, or claim settlement decision.",
    assessment_source: visualEvidence ? "AgroCycle Visual Observation" : "Local Evidence Review Engine",
    date_of_review: today
  };
}
