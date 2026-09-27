/**
 * Safe Localized Text Resolver for AgroCycle Decision Engine Outputs
 * 
 * Bridges raw decision engine strings, keys, and dynamic parameters
 * to the active localization dictionary via LanguageContext's t() function.
 */

export function getLocalizedDecisionText(text, key, params, t) {
  if (typeof t !== "function") return text || "";

  // 1. Direct key resolution if provided
  if (key) {
    const directTranslation = t(key, params);
    if (directTranslation && directTranslation !== key) {
      return directTranslation;
    }
  }

  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();

  // 2. Safety Restrictions
  if (trimmed.includes("must not be assumed safe for livestock feed or direct food consumption")) {
    return t("decision.safetyLivestockFeedFood");
  }
  if (trimmed.includes("must not be assumed safe for livestock feed")) {
    return t("decision.safetyLivestockFeed");
  }
  if (trimmed.includes("should not be exchanged with other farms to prevent disease spread")) {
    return t("decision.safetyPreventSpread");
  }
  if (trimmed.includes("Minor visual symptoms detected. Agronomic check advised prior to exchange")) {
    return t("decision.safetyMinorSymptoms");
  }
  if (trimmed.includes("Ensure material is isolated from healthy fields")) {
    return t("decision.safetyIsolateHealthy");
  }

  // 3. Disclaimers
  if (trimmed.includes("Actual suitability depends on material type, buyer requirements")) {
    return t("decision.disclaimerWaste");
  }
  if (trimmed.includes("Material may be suitable for feed-resource recovery; final feed safety")) {
    return t("decision.disclaimerSilage");
  }
  if (trimmed.includes("Potential insurance-loss assessment recommended; does not guarantee")) {
    return t("decision.disclaimerInsurance");
  }
  if (trimmed.includes("Potential sustainable-waste diversion opportunity. Consider eligible")) {
    return t("decision.disclaimerCarbon");
  }
  if (trimmed.includes("Material may have value as an agricultural resource for community exchange")) {
    return t("decision.disclaimerCommunity");
  }

  // 4. Reasons by Pathway
  // Silage Bank
  if (trimmed.includes("Disease-specific visual indicators detected. Feed conversion cannot be recommended")) {
    return t("decision.silageReason_diseased");
  }
  if (trimmed.includes("No disease-specific visual indicators detected. Material may be evaluated for feed suitability")) {
    return t("decision.silageReason_clean_conditional");
  }
  if (trimmed.includes("Clean crop material with confirmed feed-resource recovery intent")) {
    return t("decision.silageReason_feed_intent");
  }
  if (trimmed.includes("Clean crop material with residue/fodder context")) {
    return t("decision.silageReason_residue");
  }
  if (trimmed.includes("Feed recovery not requested by farmer")) {
    return t("decision.silageReason_not_requested");
  }

  // Claim Rocket
  if (trimmed.includes("No disease-specific damage indicators detected on foliage to warrant crop loss filing")) {
    return t("decision.claimReason_no_damage");
  }
  if (trimmed.includes("Observed crop damage (Visual Disease Burden:")) {
    const match = trimmed.match(/Visual Disease Burden:\s*([\d.]+)/i);
    const burden = match ? match[1] : (params?.burden || "0");
    return t("decision.claimReason_damage_interest", { burden });
  }
  if (trimmed.includes("Farmer indicated no active insurance policy or loss claim consideration")) {
    return t("decision.claimReason_no_policy");
  }
  if (trimmed.includes("Significant visual disease burden (") && trimmed.includes("detected. Potential insurance-loss")) {
    const match = trimmed.match(/Significant visual disease burden\s*\(([\d.]+)/i);
    const burden = match ? match[1] : (params?.burden || "0");
    return t("decision.claimReason_substantial", { burden });
  }
  if (trimmed.includes("Visual damage is below standard threshold for primary insurance routing")) {
    return t("decision.claimReason_below_threshold");
  }

  // Carbon Cash
  if (trimmed.includes("Active burning risk identified. Sustainable diversion through controlled composting")) {
    return t("decision.carbonReason_burning_yes");
  }
  if (trimmed.includes("No immediate burning risk reported. Material can still be evaluated")) {
    return t("decision.carbonReason_burning_no");
  }
  if (trimmed.includes("Material condition suggests potential waste diversion opportunity if field burning would otherwise occur")) {
    return t("decision.carbonReason_diversion_opportunity");
  }
  if (trimmed.includes("No immediate field-burning risk indicated from current visual scan")) {
    return t("decision.carbonReason_no_risk");
  }

  // AgroConnect
  if (trimmed.includes("Sharing diseased material across the farming community risks pathogen dissemination")) {
    return t("decision.agroReason_diseased");
  }
  if (trimmed.includes("Farmer indicated no interest in community exchange")) {
    return t("decision.agroReason_no_interest");
  }
  if (trimmed.includes("Confirmed community exchange intent. Material suitable for local farmer")) {
    return t("decision.agroReason_intent_confirmed");
  }
  if (trimmed.includes("Material appears suitable for community resource sharing and localized agricultural exchange")) {
    return t("decision.agroReason_residue");
  }
  if (trimmed.includes("No disease-specific visual indicator detected on foliage. Suitable for community resource")) {
    return t("decision.agroReason_clean");
  }
  if (trimmed.includes("Visual symptoms present; community exchange requires careful segregation")) {
    return t("decision.agroReason_symptoms_segregate");
  }

  // Urban Waste Matcher
  if (trimmed.includes("Default non-food recovery assessment pathway for damaged/excess material when other pathway context is unavailable")) {
    return t("decision.wasteReason_default");
  }
  if (trimmed.includes("Confirmed industrial/processing sale interest. Material suitable for non-food off-take evaluation")) {
    return t("decision.wasteReason_processing_intent");
  }
  if (trimmed.includes("No disease-specific damage detected. Non-food industrial sale is optional if commercial surplus exists")) {
    return t("decision.wasteReason_clean_optional");
  }
  if (trimmed.includes("Commercial surplus/material available for industrial/processing off-take matching")) {
    return t("decision.wasteReason_surplus");
  }

  // 5. Actions
  if (trimmed === "Animal Feed Conversion Ineligible") return t("decision.actionSilageIneligible");
  if (trimmed === "Feed-Resource Evaluation & Silage Conversion Assessment") return t("decision.actionSilageAssessment");
  if (trimmed === "Insurance Assessment Inactive") return t("decision.actionClaimInactive");
  if (trimmed === "Crop Damage Assessment & Insurance-Loss Filing Evaluation") return t("decision.actionClaimEvaluation");
  if (trimmed === "Sustainable-Waste Diversion & Composting/Biochar Verification") return t("decision.actionCarbonVerification");
  if (trimmed === "General Eco-Waste Management") return t("decision.actionCarbonGeneral");
  if (trimmed === "Community Exchange Ineligible") return t("decision.actionAgroIneligible");
  if (trimmed === "Community Exchange Inactive") return t("decision.actionAgroInactive");
  if (trimmed === "Community Waste/Residue Exchange & Local Resource Sharing") return t("decision.actionAgroSharing");
  if (trimmed === "Direct Field Monitoring & Community Sharing Evaluation") return t("decision.actionAgroMonitoring");
  if (trimmed === "Community Exchange Evaluation") return t("decision.actionAgroEvaluation");
  if (trimmed === "Resource Recovery Assessment & Industrial/Processing Evaluation") return t("decision.actionWasteProcessing");
  if (trimmed === "Surplus Off-Take & Processing Matcher Assessment") return t("decision.actionWasteSurplus");

  // 6. Missing Context Notices
  if (trimmed.includes("Feed-resource suitability and livestock feed recovery interest must be confirmed")) {
    return t("decision.missingSilageConfirm");
  }
  if (trimmed.includes("Active insurance policy coverage and insurance-loss claim consideration context required")) {
    return t("decision.missingClaimPolicy");
  }
  if (trimmed.includes("Confirmation needed if material is at risk of field burning")) {
    return t("decision.missingCarbonBurning");
  }
  if (trimmed.includes("Community sharing intent or agricultural surplus/residue availability context can be specified")) {
    return t("decision.missingAgroSharing");
  }
  if (trimmed.includes("Community exchange interest context required")) {
    return t("decision.missingAgroInterest");
  }
  if (trimmed.includes("Specify buyer/processing preferences (biofuel, starch, composting, industrial) to refine matching")) {
    return t("decision.missingWasteIndustrial");
  }
  if (trimmed.includes("Specify surplus volume or buyer preferences to activate commercial matching")) {
    return t("decision.missingWasteSurplus");
  }

  // 7. Status Badges
  if (trimmed.toLowerCase() === "recommended") return t("decision.statusRecommended");
  if (trimmed.toLowerCase() === "conditional") return t("decision.statusConditional");
  if (trimmed.toLowerCase() === "not eligible") return t("decision.statusNotEligible");

  return text;
}
