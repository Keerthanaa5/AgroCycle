/**
 * AgroCycle Market Intelligence & Fresh Produce Procurement Master Constants
 * 
 * Shared Taxonomy for:
 * 1. BUYER TYPE
 * 2. INTENDED USE / PURPOSE
 * 3. SHARED MARKET INTELLIGENCE GRADE TAXONOMY
 * 
 * Scope: Market Intelligence & Fresh Produce Procurement ONLY.
 * (Urban Waste Matcher & Silage Bank are isolated and untouched).
 */

export const BUYER_TYPES = {
  SUPERMARKET_RETAILER: "Supermarket / Retailer",
  FOOD_PROCESSOR: "Food Processor",
  FOOD_SERVICE: "Food Service",
  WHOLESALE_EXPORT: "Wholesale / Export"
};

export const BUYER_TYPE_OPTIONS = [
  "Supermarket / Retailer",
  "Food Processor",
  "Food Service",
  "Wholesale / Export"
];

export const INTENDED_USES = {
  FRESH_RETAIL: "Fresh Retail",
  PROCESSING: "Processing",
  SAUCE_KETCHUP: "Sauce / Ketchup",
  JUICE_BEVERAGE: "Juice / Beverage",
  FOOD_SERVICE: "Food Service",
  EXPORT: "Export"
};

export const INTENDED_USE_OPTIONS = [
  "Fresh Retail",
  "Processing",
  "Sauce / Ketchup",
  "Juice / Beverage",
  "Food Service",
  "Export"
];

export const MARKET_INTELLIGENCE_GRADES = {
  GRADE_A_PREMIUM: "Grade A — Fresh / Premium",
  GRADE_B_COMMERCIAL: "Grade B — Commercial",
  GRADE_B_PROCESSING: "Grade B — Processing",
  GRADE_C_SURPLUS: "Grade C — Damaged / Surplus"
};

export const MARKET_INTELLIGENCE_GRADE_OPTIONS = [
  "Grade A — Fresh / Premium",
  "Grade B — Commercial",
  "Grade B — Processing",
  "Grade C — Damaged / Surplus"
];

/**
 * Safely normalizes any legacy condition or quality string to the master taxonomy
 * without corrupting existing database records.
 *
 * @param {string} raw - Input grade, condition, or legacy string
 * @returns {string} Standardized Market Intelligence grade
 */
export function normalizeMarketIntelligenceGrade(raw) {
  if (!raw || typeof raw !== "string") {
    return MARKET_INTELLIGENCE_GRADES.GRADE_B_COMMERCIAL;
  }

  const trimmed = raw.trim();

  // Exact match with master taxonomy
  if (MARKET_INTELLIGENCE_GRADE_OPTIONS.includes(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();

  // Grade C / Damaged / Surplus
  if (
    lower.includes("damaged") && !lower.includes("slightly") ||
    lower.includes("surplus") ||
    lower.includes("grade c") ||
    lower.includes("grade_c") ||
    lower.includes("grade-c") ||
    lower.includes("critical") ||
    lower.includes("heavy") ||
    lower === "c"
  ) {
    return MARKET_INTELLIGENCE_GRADES.GRADE_C_SURPLUS;
  }

  // Grade B — Processing / Sauce / Pulp / Slightly Damaged
  if (
    lower.includes("slightly_damaged") ||
    lower.includes("slightly damaged") ||
    lower.includes("processing") ||
    lower.includes("sauce") ||
    lower.includes("ketchup") ||
    lower.includes("juice") ||
    lower.includes("pulp") ||
    lower.includes("grade b — processing") ||
    lower.includes("grade b - processing") ||
    lower.includes("grade b processing")
  ) {
    return MARKET_INTELLIGENCE_GRADES.GRADE_B_PROCESSING;
  }

  // Grade A — Fresh / Premium Harvest
  if (
    lower === "fresh" ||
    lower === "excellent" ||
    lower === "premium" ||
    lower.includes("premium") ||
    lower.includes("fresh / premium") ||
    lower.includes("fresh retail") ||
    lower.includes("grade a — fresh") ||
    lower.includes("grade a - fresh") ||
    lower === "grade a" ||
    lower === "grade_a" ||
    lower === "grade-a" ||
    lower === "a"
  ) {
    return MARKET_INTELLIGENCE_GRADES.GRADE_A_PREMIUM;
  }

  // Grade B — Commercial Standard / Good
  if (
    lower === "good" ||
    lower.includes("commercial") ||
    lower.includes("standard") ||
    lower.includes("grade a/b") ||
    lower.includes("grade b — commercial") ||
    lower.includes("grade b - commercial") ||
    lower === "grade b" ||
    lower === "grade_b" ||
    lower === "grade-b" ||
    lower === "b"
  ) {
    return MARKET_INTELLIGENCE_GRADES.GRADE_B_COMMERCIAL;
  }

  return MARKET_INTELLIGENCE_GRADES.GRADE_B_COMMERCIAL;
}

/**
 * Evaluates whether a farmer supply lot is compatible with a buyer's demand requirements.
 * 
 * Strict business rules:
 * 1. Fresh Retail: Must NOT match Grade C — Damaged / Surplus. Requires Grade A — Fresh / Premium (or Grade B Commercial if buyer explicitly accepted it).
 * 2. Processing / Sauce / Ketchup / Juice: Accepts Grade B — Processing, Grade B — Commercial, or Grade A — Fresh / Premium (if accepted by buyer).
 * 3. Buyer's declared accepted grade(s) must include or be compatible with the farmer's declared grade.
 * 4. Buyer Type does NOT automatically dictate grade.
 * 5. Intended Use does NOT automatically dictate grade.
 *
 * @param {string} farmerGradeOrCondition - Farmer's declared grade
 * @param {Object} demand - Buyer demand object
 * @returns {boolean} True if compatible
 */
export function checkGradeAndIntendedUseCompatibility(farmerGradeOrCondition, demand = {}) {
  const normFarmerGrade = normalizeMarketIntelligenceGrade(farmerGradeOrCondition);
  const buyerAcceptedGradeRaw = demand.qualityGrade || demand.acceptedGrade || demand.grade || null;
  const buyerAcceptedGradesArray = Array.isArray(demand.acceptedGrades) 
    ? demand.acceptedGrades.map(normalizeMarketIntelligenceGrade)
    : [];

  const intendedUse = (demand.intendedUse || "").toLowerCase().trim();

  // Rule 1: Grade C — Damaged / Surplus is NEVER compatible with Fresh Retail or Export
  if (normFarmerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_C_SURPLUS) {
    if (
      intendedUse === "fresh retail" || 
      intendedUse === "export" || 
      demand.buyerType === "Supermarket / Retailer"
    ) {
      return false; // Strictly rejected
    }
  }

  // If buyer explicitly provided a list of accepted grades
  if (buyerAcceptedGradesArray.length > 0) {
    return buyerAcceptedGradesArray.includes(normFarmerGrade);
  }

  // If buyer provided a single qualityGrade
  if (buyerAcceptedGradeRaw && buyerAcceptedGradeRaw !== "any" && buyerAcceptedGradeRaw !== "All Grades") {
    const normBuyerGrade = normalizeMarketIntelligenceGrade(buyerAcceptedGradeRaw);

    // If buyer explicitly asked for Grade A — Fresh / Premium:
    if (normBuyerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_A_PREMIUM) {
      return normFarmerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_A_PREMIUM;
    }

    // If buyer explicitly asked for Grade B — Commercial:
    if (normBuyerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_B_COMMERCIAL) {
      // Commercial buyers can accept Grade A or Grade B Commercial
      return (
        normFarmerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_A_PREMIUM ||
        normFarmerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_B_COMMERCIAL
      );
    }

    // If buyer explicitly asked for Grade B — Processing:
    if (normBuyerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_B_PROCESSING) {
      // Processing can use Grade B Processing, Grade B Commercial, or Grade A Premium
      return (
        normFarmerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_A_PREMIUM ||
        normFarmerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_B_COMMERCIAL ||
        normFarmerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_B_PROCESSING
      );
    }

    // If buyer asked for Grade C — Damaged / Surplus:
    if (normBuyerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_C_SURPLUS) {
      return true; // Any grade can fulfill surplus clearance
    }

    // Default exact match
    return normFarmerGrade === normBuyerGrade;
  }

  // If no grade specified, check general intended use safety
  if (intendedUse === "fresh retail" || intendedUse === "export") {
    return normFarmerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_A_PREMIUM || normFarmerGrade === MARKET_INTELLIGENCE_GRADES.GRADE_B_COMMERCIAL;
  }

  return normFarmerGrade !== MARKET_INTELLIGENCE_GRADES.GRADE_C_SURPLUS;
}
