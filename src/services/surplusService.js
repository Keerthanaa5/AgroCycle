/**
 * AgroCycle Surplus Detection Engine (Layer C — Market Intelligence)
 *
 * Evaluates farmer supply against matched commercial buyer capacity
 * to identify potential surplus and recommend timely value-recovery routes.
 *
 * CRITICAL RULE:
 * Never say "X kg will be wasted."
 * Always use respectful and objective wording: "Potential surplus: X kg"
 * because the farmer may still find another buyer or channel.
 */

/**
 * Calculates surplus given available farmer quantity and matched buyer capacities.
 *
 * @param {Object} params
 * @param {number|null} params.availableQuantity - Farmer's harvest supply (kg)
 * @param {Array} [params.matchedBuyers] - List of matched buyers
 * @param {number} [params.matchedBuyerCapacity] - Optional pre-computed total buyer capacity
 * @param {string} [params.unit] - Unit of measurement (default: "kg")
 * @returns {Object}
 */
export function calculateSurplus({
  availableQuantity = null,
  matchedBuyers = [],
  matchedBuyerCapacity = null,
  unit = "kg"
} = {}) {
  const hasQuantity =
    typeof availableQuantity === "number" &&
    !isNaN(availableQuantity) &&
    availableQuantity > 0;

  if (!hasQuantity) {
    return {
      status: "unspecified",
      availableQuantity: null,
      matchedBuyerCapacity: 0,
      potentialSurplus: 0,
      unit,
      message: "Quantity not provided. Buyer capacity comparison is unavailable.",
      recommendationHint: "Enter your estimated harvest quantity to check for potential market surplus."
    };
  }

  const farmerQty = Number(availableQuantity);
  const totalBuyerCap =
    typeof matchedBuyerCapacity === "number"
      ? matchedBuyerCapacity
      : (Array.isArray(matchedBuyers) ? matchedBuyers : []).reduce(
          (sum, b) => sum + (Number(b.matchedRequirement?.quantityRequired) || 0),
          0
        );

  if (farmerQty > totalBuyerCap) {
    const surplus = Math.max(0, farmerQty - totalBuyerCap);
    return {
      status: "potential-surplus",
      availableQuantity: farmerQty,
      matchedBuyerCapacity: totalBuyerCap,
      potentialSurplus: surplus,
      unit,
      message: "Some quantity may require an alternative commercial or recovery route.",
      detailText: `Matched buyers can absorb ${totalBuyerCap.toLocaleString()} ${unit} out of your ${farmerQty.toLocaleString()} ${unit} supply.`,
      recommendationHint: `Consider routing the remaining ${surplus.toLocaleString()} ${unit} to food processing, Urban Waste Matcher, or community exchange.`
    };
  }

  // When buyer demand fully meets or exceeds farmer supply
  return {
    status: "sufficient-demand",
    availableQuantity: farmerQty,
    matchedBuyerCapacity: totalBuyerCap,
    potentialSurplus: 0,
    unit,
    message: "No immediate surplus indicated from matched buyer demand.",
    detailText: `Matched buyer capacity (${totalBuyerCap.toLocaleString()} ${unit}) is sufficient to absorb your entire ${farmerQty.toLocaleString()} ${unit} harvest.`,
    recommendationHint: "You can connect directly with the matched buyers to fulfill procurement orders."
  };
}
