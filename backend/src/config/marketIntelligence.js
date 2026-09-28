/**
 * AgroCycle Market Intelligence & Fresh Produce Procurement Master Constants (Backend)
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

export function normalizeMarketIntelligenceGrade(raw) {
  if (!raw || typeof raw !== "string") {
    return MARKET_INTELLIGENCE_GRADES.GRADE_B_COMMERCIAL;
  }

  const trimmed = raw.trim();
  if (MARKET_INTELLIGENCE_GRADE_OPTIONS.includes(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();

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
