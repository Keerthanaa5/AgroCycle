/**
 * AgroCycle Demand Signal Engine (Layer C — Market Intelligence)
 *
 * Computes deterministic commercial demand signals based exclusively
 * on active, visible procurement requirements of registered buyers.
 *
 * CRITICAL RULE:
 * This is a deterministic visible demand calculation, NOT an ML prediction.
 * Never label this "AI Predicted Demand". Always label as "Demand Signal" or "Visible Buyer Demand".
 */

export const DEMAND_THRESHOLDS = {
  STRONG_MULTIPLIER: 2.0,  // Demand >= 2x farmer supply
  MODERATE_MULTIPLIER: 1.0  // Demand >= 1x farmer supply
};

/**
 * Calculates deterministic demand signal from matched buyers and farmer supply.
 *
 * @param {Object} params
 * @param {Array} params.matchedBuyers - Matched buyer list from buyerMatchingService
 * @param {number|null} [params.availableFarmerQuantity] - Farmer's available quantity (kg)
 * @param {string} [params.crop] - Crop name
 * @returns {Object} Deterministic demand signal summary
 */
export function calculateDemandSignal({
  matchedBuyers = [],
  availableFarmerQuantity = null,
  crop = "crop"
} = {}) {
  const buyers = Array.isArray(matchedBuyers) ? matchedBuyers : [];
  const totalVisibleDemandKg = buyers.reduce(
    (sum, b) => sum + (Number(b.matchedRequirement?.quantityRequired) || 0),
    0
  );

  const buyerCount = buyers.length;
  const farmerQty = Number(availableFarmerQuantity);
  const hasFarmerQty = typeof availableFarmerQuantity === "number" && !isNaN(availableFarmerQuantity) && availableFarmerQuantity > 0;

  if (buyerCount === 0 || totalVisibleDemandKg === 0) {
    return {
      level: "none",
      label: "No Visible Demand",
      color: "muted",
      totalVisibleDemandKg: 0,
      availableFarmerQuantity: hasFarmerQty ? farmerQty : null,
      matchedBuyerCount: 0,
      explanation: `No active procurement requirements found for ${crop} from nearby registered buyers.`,
      isDeterministic: true,
      disclaimer: "Based on active procurement requirements from currently registered buyers."
    };
  }

  if (hasFarmerQty) {
    if (totalVisibleDemandKg >= farmerQty * DEMAND_THRESHOLDS.STRONG_MULTIPLIER) {
      return {
        level: "strong",
        label: "Strong Demand Signal",
        badgeText: "Strong",
        color: "emerald",
        totalVisibleDemandKg,
        availableFarmerQuantity: farmerQty,
        matchedBuyerCount: buyerCount,
        explanation: `${totalVisibleDemandKg.toLocaleString()} kg currently requested by ${buyerCount} matching registered buyer${buyerCount > 1 ? "s" : ""}.`,
        isDeterministic: true,
        disclaimer: "Based on active procurement requirements from currently registered buyers."
      };
    }

    if (totalVisibleDemandKg >= farmerQty * DEMAND_THRESHOLDS.MODERATE_MULTIPLIER) {
      return {
        level: "moderate",
        label: "Moderate Demand Signal",
        badgeText: "Moderate",
        color: "amber",
        totalVisibleDemandKg,
        availableFarmerQuantity: farmerQty,
        matchedBuyerCount: buyerCount,
        explanation: `${totalVisibleDemandKg.toLocaleString()} kg currently requested by ${buyerCount} matching registered buyer${buyerCount > 1 ? "s" : ""}.`,
        isDeterministic: true,
        disclaimer: "Based on active procurement requirements from currently registered buyers."
      };
    }

    return {
      level: "limited",
      label: "Limited Demand Signal",
      badgeText: "Limited",
      color: "sky",
      totalVisibleDemandKg,
      availableFarmerQuantity: farmerQty,
      matchedBuyerCount: buyerCount,
      explanation: `${totalVisibleDemandKg.toLocaleString()} kg currently requested by ${buyerCount} matching registered buyer${buyerCount > 1 ? "s" : ""}.`,
      isDeterministic: true,
      disclaimer: "Based on active procurement requirements from currently registered buyers."
    };
  }

  // When farmer did not specify available quantity
  return {
    level: "available",
    label: "Visible Buyer Demand",
    badgeText: "Visible Demand",
    color: "emerald",
    totalVisibleDemandKg,
    availableFarmerQuantity: null,
    matchedBuyerCount: buyerCount,
    explanation: `${totalVisibleDemandKg.toLocaleString()} kg currently requested across ${buyerCount} registered buyer${buyerCount > 1 ? "s" : ""}. Enter your harvest quantity to compare capacity.`,
    isDeterministic: true,
    disclaimer: "Based on active procurement requirements from currently registered buyers."
  };
}
