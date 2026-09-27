import { getDiseaseLabel, getCropLabel, YOLO_DISEASE_LABELS, CROP_NAMES } from "./i18n/diseases.js";
import { getLocalizedDecisionText } from "./i18n/decisionText.js";
import en from "../src/i18n/en.js";
import ta from "../src/i18n/ta.js";
import hi from "../src/i18n/hi.js";

console.log("==================================================");
console.log("AGROCYCLE MULTILINGUAL VERIFICATION TEST SUITE");
console.log("==================================================");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// TEST 1: Disease localization for all 19 YOLO classes
console.log("\n--- TEST 1: YOLO11n Disease Display Mapping ---");
const yoloClasses = [
  "corn_leaf_blight", "corn_rust", "corn_gray_leaf_spot", "corn_healthy",
  "tomato_early_blight_leaf", "tomato_late_blight_leaf", "tomato_leaf_mold",
  "tomato_septoria_leaf_spot", "tomato_spider_mites", "tomato_yellow_leaf_curl_virus",
  "tomato_mosaic_virus", "tomato_leaf", "potato_leaf_early_blight",
  "potato_leaf_late_blight", "potato_leaf", "grape_leaf_black_rot",
  "grape_leaf", "bell_pepper_leaf_spot", "bell_pepper_leaf"
];

for (const cls of yoloClasses) {
  const enLabel = getDiseaseLabel(cls, "en");
  const taLabel = getDiseaseLabel(cls, "ta");
  const hiLabel = getDiseaseLabel(cls, "hi");
  assert(enLabel && enLabel !== cls, `[${cls}] English display label: "${enLabel}"`);
  assert(taLabel && taLabel !== enLabel && taLabel.length > 0, `[${cls}] Tamil display label: "${taLabel}"`);
  assert(hiLabel && hiLabel !== enLabel && hiLabel.length > 0, `[${cls}] Hindi display label: "${hiLabel}"`);
}

// TEST 2: Generic leaf classes display label check
console.log("\n--- TEST 2: Generic Leaf Classes Check ---");
const genericLeaves = ["tomato_leaf", "potato_leaf", "grape_leaf", "bell_pepper_leaf"];
for (const leaf of genericLeaves) {
  const enL = getDiseaseLabel(leaf, "en");
  const taL = getDiseaseLabel(leaf, "ta");
  const hiL = getDiseaseLabel(leaf, "hi");
  assert(enL.toLowerCase().includes("foliage") || enL.toLowerCase().includes("leaf"), `[${leaf}] English is foliage: "${enL}"`);
  assert(taL.length > 0, `[${leaf}] Tamil label exists: "${taL}"`);
  assert(hiL.length > 0, `[${leaf}] Hindi label exists: "${hiL}"`);
}

// TEST 3: Unknown class fallback behavior (must not crash or return undefined)
console.log("\n--- TEST 3: Safe Fallback for Unknown Classes ---");
const unknownCls = "unknown_exotic_fungus_leaf";
const unknownEn = getDiseaseLabel(unknownCls, "en");
const unknownTa = getDiseaseLabel(unknownCls, "ta");
const unknownHi = getDiseaseLabel(unknownCls, "hi");
assert(unknownEn === "Unknown Exotic Fungus Leaf", `Unknown class falls back to title case in English: "${unknownEn}"`);
assert(unknownTa === "Unknown Exotic Fungus Leaf", `Unknown class falls back safely in Tamil without crashing: "${unknownTa}"`);
assert(unknownHi === "Unknown Exotic Fungus Leaf", `Unknown class falls back safely in Hindi without crashing: "${unknownHi}"`);

// TEST 4: Key Parity between en, ta, hi
console.log("\n--- TEST 4: Key Parity Across Dictionaries ---");
function getKeys(obj, prefix = "") {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = getKeys(en);
const taKeys = getKeys(ta);
const hiKeys = getKeys(hi);

console.log(`Total keys: en=${enKeys.length}, ta=${taKeys.length}, hi=${hiKeys.length}`);

let missingTa = enKeys.filter(k => !taKeys.includes(k));
let missingHi = enKeys.filter(k => !hiKeys.includes(k));

assert(missingTa.length === 0, `Tamil dictionary has 100% key parity (missing ${missingTa.length})`);
if (missingTa.length > 0) console.log("Missing in TA:", missingTa);

assert(missingHi.length === 0, `Hindi dictionary has 100% key parity (missing ${missingHi.length})`);
if (missingHi.length > 0) console.log("Missing in HI:", missingHi);

// TEST 5: Claim Rocket Legal Disclaimer & Helpline Check
console.log("\n--- TEST 5: Claim Rocket Safety & Legal Text ---");
assert(en.claimRocket.helplineButton.includes("14447"), `English helpline includes 14447: "${en.claimRocket.helplineButton}"`);
assert(ta.claimRocket.helplineButton.includes("14447"), `Tamil helpline includes 14447: "${ta.claimRocket.helplineButton}"`);
assert(hi.claimRocket.helplineButton.includes("14447"), `Hindi helpline includes 14447: "${hi.claimRocket.helplineButton}"`);

assert(en.claimRocket.legalDisclaimerText.includes("PMFBY") && en.claimRocket.legalDisclaimerText.includes("NOT"), "English disclaimer preserves PMFBY & non-assessment rule");
assert(ta.claimRocket.legalDisclaimerText.includes("PMFBY") || ta.claimRocket.legalDisclaimerText.includes("pmfby.gov.in"), "Tamil disclaimer preserves PMFBY reference");
assert(hi.claimRocket.legalDisclaimerText.includes("PMFBY") || hi.claimRocket.legalDisclaimerText.includes("pmfby.gov.in"), "Hindi disclaimer preserves PMFBY reference");

// TEST 6: Interpolation Safety
console.log("\n--- TEST 6: Interpolation Safety Check ---");
function interpolate(template, params = {}) {
  if (typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? params[key] : match;
  });
}

const greetingEn = interpolate(en.dashboard.greetingMorning, { name: "Ramesh" });
const greetingTa = interpolate(ta.dashboard.greetingMorning, { name: "ரமேஷ்" });
const greetingHi = interpolate(hi.dashboard.greetingMorning, { name: "रमेश" });

assert(greetingEn === "Good morning, Ramesh!", `Interpolated English: "${greetingEn}"`);
assert(greetingTa === "காலை வணக்கம், ரமேஷ்!", `Interpolated Tamil: "${greetingTa}"`);
assert(greetingHi === "सुप्रभात, रमेश!", `Interpolated Hindi: "${greetingHi}"`);

const diseaseMsgEn = interpolate(en.scanner.diseaseDetectedMsg, { disease: "Tomato Late Blight", confidence: 88.5 });
const diseaseMsgTa = interpolate(ta.scanner.diseaseDetectedMsg, { disease: "தக்காளி தாமத கருகல் நோய்", confidence: 88.5 });
const diseaseMsgHi = interpolate(hi.scanner.diseaseDetectedMsg, { disease: "टमाटर लेट ब्लाइट", confidence: 88.5 });

assert(diseaseMsgEn.includes("88.5%"), `English confidence preserved: "${diseaseMsgEn}"`);
assert(diseaseMsgTa.includes("88.5%"), `Tamil confidence preserved: "${diseaseMsgTa}"`);
assert(diseaseMsgHi.includes("88.5%"), `Hindi confidence preserved: "${diseaseMsgHi}"`);

// TEST 7: Phase 5 Voice Assistance Localization & Parity
console.log("\n--- TEST 7: Phase 5 Voice Assistance Localization ---");
assert(en.voice && en.voice.listen === "Listen", `English voice button label: "${en.voice?.listen}"`);
assert(ta.voice && ta.voice.listen === "கேட்க", `Tamil voice button label: "${ta.voice?.listen}"`);
assert(hi.voice && hi.voice.listen === "सुनें", `Hindi voice button label: "${hi.voice?.listen}"`);

assert(en.voice.notSupported.includes("Voice playback is not supported"), `English unsupported notice present`);
assert(ta.voice.notSupported.includes("குரல் இயக்கம் ஆதரிக்கப்படவில்லை"), `Tamil unsupported notice present`);
assert(hi.voice.notSupported.includes("वॉइस प्लेबैक समर्थित नहीं है"), `Hindi unsupported notice present`);

assert(en.voice.voiceUnavailable.includes("English voice"), `English unavailable notice present`);
assert(ta.voice.voiceUnavailable.includes("தமிழ் குரல்"), `Tamil unavailable notice present`);
assert(hi.voice.voiceUnavailable.includes("हिंदी"), `Hindi unavailable notice present`);

// TEST 8: Voice Service Text Cleaner Sanitization
console.log("\n--- TEST 8: Voice Service Text Cleaner Sanitization ---");
function cleanTextForSpeech(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_~`#]/g, "")
    .replace(/•/g, ", ")
    .replace(/₹/g, " Rupees ")
    .replace(/%/g, " percent ")
    .replace(/&/g, " and ")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[\r\n\t]+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

const sampleDirtyText = "**Potato Late Blight** detected with 92.5% confidence! • Cost: ₹15000 & Visit https://pmfby.gov.in <br/> Next steps.";
const cleaned = cleanTextForSpeech(sampleDirtyText);
assert(!cleaned.includes("**") && !cleaned.includes("<br/>") && !cleaned.includes("https://"), `Cleaned formatting & URLs: "${cleaned}"`);
assert(cleaned.includes("92.5 percent") && cleaned.includes("Rupees 15000"), `Cleaned percentage & currency symbols: "${cleaned}"`);

// TEST 9: Spoken Scanner Result NEVER includes raw class IDs
console.log("\n--- TEST 9: Spoken Scanner Output Uses Localized Labels (No Raw IDs) ---");
const rawId = "potato_leaf_late_blight";
const spokenTa = getDiseaseLabel(rawId, "ta");
const spokenHi = getDiseaseLabel(rawId, "hi");
const spokenEn = getDiseaseLabel(rawId, "en");

assert(!spokenTa.includes("potato_leaf_late_blight") && spokenTa === "உருளைக்கிழங்கு தாமத கருகல் நோய்", `Tamil spoken label is localized: "${spokenTa}"`);
assert(!spokenHi.includes("potato_leaf_late_blight") && spokenHi === "आलू पछेती झुलसा (लेट ब्लाइट)", `Hindi spoken label is localized: "${spokenHi}"`);
assert(!spokenEn.includes("potato_leaf_late_blight") && spokenEn === "Potato Late Blight", `English spoken label is localized: "${spokenEn}"`);

// TEST 10: Decision Engine Full Localization Coverage & Safety Rules
console.log("\n--- TEST 10: Decision Engine Localization Coverage & Safety Rules ---");
assert(en.decision && ta.decision && hi.decision, "Decision namespaces exist across all 3 languages");

// Verify Safety Warning Text
assert(en.decision.safetyLivestockFeedFood.includes("livestock feed or direct food consumption"), `English safety warning complete`);
assert(ta.decision.safetyLivestockFeedFood.includes("கால்நடைத் தீவனமாகவோ") && ta.decision.safetyLivestockFeedFood.includes("உணவுப் பயன்பாட்டிற்கோ"), `Tamil safety warning complete: "${ta.decision.safetyLivestockFeedFood}"`);
assert(hi.decision.safetyLivestockFeedFood.includes("पशु चारे") && hi.decision.safetyLivestockFeedFood.includes("खाद्य उपयोग"), `Hindi safety warning complete: "${hi.decision.safetyLivestockFeedFood}"`);

// Verify Urban Waste Matcher Default Reason
assert(ta.decision.wasteReason_default.includes("Urban Waste Matcher") && ta.decision.wasteReason_default.includes("மீட்பு"), `Tamil Urban Waste Matcher reason localized`);
assert(hi.decision.wasteReason_default.includes("Urban Waste Matcher") && hi.decision.wasteReason_default.includes("रिकवरी"), `Hindi Urban Waste Matcher reason localized`);

// Verify Claim Rocket Significant Burden Interpolation
const claimEn = interpolate(en.decision.claimReason_substantial, { burden: "82.9" });
const claimTa = interpolate(ta.decision.claimReason_substantial, { burden: "82.9" });
const claimHi = interpolate(hi.decision.claimReason_substantial, { burden: "82.9" });
assert(claimEn.includes("82.9/100"), `English claim interpolation: "${claimEn}"`);
assert(claimTa.includes("82.9/100") && claimTa.includes("காட்சி நோய் பாதிப்பு"), `Tamil claim interpolation: "${claimTa}"`);
assert(claimHi.includes("82.9/100") && claimHi.includes("दृश्य रोग प्रभाव"), `Hindi claim interpolation: "${claimHi}"`);

// Verify Carbon Cash Diversion Reason
assert(ta.decision.carbonReason_diversion_opportunity.includes("கழிவு மீட்பு"), `Tamil Carbon Cash reason localized`);
assert(hi.decision.carbonReason_diversion_opportunity.includes("अपशिष्ट डायवर्जन"), `Hindi Carbon Cash reason localized`);

// TEST 11: getLocalizedDecisionText Helper Resolution
console.log("\n--- TEST 11: getLocalizedDecisionText Helper Dynamic Resolution ---");

function mockT(dict) {
  return (key, params = {}) => {
    const parts = key.split(".");
    let curr = dict;
    for (const p of parts) {
      if (curr && typeof curr === "object" && p in curr) curr = curr[p];
      else return key;
    }
    if (typeof curr !== "string") return key;
    return curr.replace(/\{(\w+)\}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
  };
}

const tTa = mockT(ta);
const tHi = mockT(hi);
const tEn = mockT(en);

const rawWasteReason = "Default non-food recovery assessment pathway for damaged/excess material when other pathway context is unavailable.";
assert(getLocalizedDecisionText(rawWasteReason, null, null, tTa) === ta.decision.wasteReason_default, "Tamil resolves raw waste reason correctly");
assert(getLocalizedDecisionText(rawWasteReason, null, null, tHi) === hi.decision.wasteReason_default, "Hindi resolves raw waste reason correctly");
assert(getLocalizedDecisionText(rawWasteReason, null, null, tEn) === en.decision.wasteReason_default, "English resolves raw waste reason correctly");

const rawSafety = "Diseased material must not be assumed safe for livestock feed or direct food consumption.";
assert(getLocalizedDecisionText(rawSafety, null, null, tTa) === ta.decision.safetyLivestockFeedFood, "Tamil resolves raw safety restriction correctly");
assert(getLocalizedDecisionText(rawSafety, null, null, tHi) === hi.decision.safetyLivestockFeedFood, "Hindi resolves raw safety restriction correctly");

const rawClaimReason = "Significant visual disease burden (82.9/100) detected. Potential insurance-loss assessment recommended if crop is covered.";
const resolvedClaimTa = getLocalizedDecisionText(rawClaimReason, null, null, tTa);
assert(resolvedClaimTa.includes("82.9/100") && resolvedClaimTa.includes("காட்சி நோய் பாதிப்பு"), `Tamil dynamically resolves and interpolates burden: "${resolvedClaimTa}"`);

// TEST 12: Intercrop Wizard Full Localization & Voice Text Coverage
console.log("\n--- TEST 12: Intercrop Wizard Full Localization & Voice Text Coverage ---");
assert(en.intercrop && ta.intercrop && hi.intercrop, "Intercrop namespaces exist across all 3 languages");

// 1. Recommendation title test
assert(en.intercrop.crops.legumes_nitrogen_fixing === "Legumes (Nitrogen fixing)", `English crop title: "${en.intercrop.crops.legumes_nitrogen_fixing}"`);
assert(ta.intercrop.crops.legumes_nitrogen_fixing === "பயறு வகைகள் (நைட்ரஜன் நிலைநிறுத்தம்)", `Tamil crop title: "${ta.intercrop.crops.legumes_nitrogen_fixing}"`);
assert(hi.intercrop.crops.legumes_nitrogen_fixing === "दलहनी फसलें (नाइट्रोजन स्थिरीकरण)", `Hindi crop title: "${hi.intercrop.crops.legumes_nitrogen_fixing}"`);

// 2. Specific user strings requested
assert(ta.intercrop.methods.paddy_bund_planting.includes("வரப்புகளில்"), `Tamil sowing method localized: "${ta.intercrop.methods.paddy_bund_planting}"`);
assert(hi.intercrop.methods.paddy_bund_planting.includes("मेड़ों"), `Hindi sowing method localized: "${hi.intercrop.methods.paddy_bund_planting}"`);

assert(ta.intercrop.seedAvailabilities.high_local_stores.includes("எளிதில் கிடைக்கும்"), `Tamil seed availability localized: "${ta.intercrop.seedAvailabilities.high_local_stores}"`);
assert(hi.intercrop.seedAvailabilities.high_local_stores.includes("आसानी से उपलब्ध"), `Hindi seed availability localized: "${hi.intercrop.seedAvailabilities.high_local_stores}"`);

assert(ta.intercrop.benefits.nitrogen_fixation.includes("நைட்ரஜனை நிலைநிறுத்தி"), `Tamil agronomic benefit localized: "${ta.intercrop.benefits.nitrogen_fixation}"`);
assert(hi.intercrop.benefits.nitrogen_fixation.includes("नाइट्रोजन का स्थिरीकरण"), `Hindi agronomic benefit localized: "${hi.intercrop.benefits.nitrogen_fixation}"`);

assert(ta.intercrop.generalAdvices.paddy_legume_advice.includes("எஞ்சிய ஈரப்பதத்தில்"), `Tamil agronomist advice localized: "${ta.intercrop.generalAdvices.paddy_legume_advice}"`);
assert(hi.intercrop.generalAdvices.paddy_legume_advice.includes("अवशिष्ट नमी"), `Hindi agronomist advice localized: "${hi.intercrop.generalAdvices.paddy_legume_advice}"`);

// 3. Dynamic interpolation tests for match score and profit
const matchTa = interpolate(ta.intercrop.matchScore, { percent: 92 });
const matchHi = interpolate(hi.intercrop.matchScore, { percent: 92 });
const matchEn = interpolate(en.intercrop.matchScore, { percent: 92 });
assert(matchTa === "92% வேளாண் பொருத்தத்தன்மை", `Tamil match score: "${matchTa}"`);
assert(matchHi === "92% कृषि अनुकूलता स्कोर", `Hindi match score: "${matchHi}"`);
assert(matchEn === "92% agronomy match", `English match score: "${matchEn}"`);

const profitTa = interpolate(ta.intercrop.profitPerAcre, { profit: "15,000" });
const profitHi = interpolate(hi.intercrop.profitPerAcre, { profit: "15,000" });
const profitEn = interpolate(en.intercrop.profitPerAcre, { profit: "15,000" });
assert(profitTa.includes("15,000") && profitTa.includes("மதிப்பீடு"), `Tamil estimated profit: "${profitTa}"`);
assert(profitHi.includes("15,000") && profitHi.includes("अनुमानित"), `Hindi estimated profit: "${profitHi}"`);
assert(profitEn.includes("15,000") && profitEn.includes("expected profit"), `English estimated profit: "${profitEn}"`);

// 4. Cotton & Vegetable recommendations
assert(ta.intercrop.crops.groundnut === "நிலக்கடலை (வேர்க்கடலை)", `Tamil cotton intercrop: "${ta.intercrop.crops.groundnut}"`);
assert(hi.intercrop.crops.groundnut === "मूंगफली", `Hindi cotton intercrop: "${hi.intercrop.crops.groundnut}"`);
assert(ta.intercrop.crops.leafy_vegetables_marigold === "கீரை வகைகள் / சாமந்திப் பூ", `Tamil vegetable intercrop: "${ta.intercrop.crops.leafy_vegetables_marigold}"`);
assert(hi.intercrop.crops.leafy_vegetables_marigold === "पत्तेदार सब्जियां / गेंदा", `Hindi vegetable intercrop: "${hi.intercrop.crops.leafy_vegetables_marigold}"`);

// TEST 13: Gemini Hybrid Integration & Error/Advisory Keys
console.log("\n--- TEST 13: Gemini Hybrid Integration & Error/Advisory Keys ---");
// Intercrop AI enhancement keys
assert(en.intercrop.aiEnhanced === "AI-Enhanced Recommendation", "English aiEnhanced badge present");
assert(ta.intercrop.aiEnhanced === "AI-மேம்படுத்தப்பட்ட பரிந்துரை", "Tamil aiEnhanced badge present");
assert(hi.intercrop.aiEnhanced === "AI-संवर्धित अनुशंसा", "Hindi aiEnhanced badge present");

assert(en.intercrop.offlineRecommendation === "Offline Recommendation", "English offlineRecommendation badge present");
assert(ta.intercrop.offlineRecommendation === "ஆஃப்லைன் பரிந்துரை", "Tamil offlineRecommendation badge present");
assert(hi.intercrop.offlineRecommendation === "ऑफ़लाइन अनुशंसा", "Hindi offlineRecommendation badge present");

assert(ta.intercrop.aiUnavailableNotice.includes("ஆஃப்லைன்"), `Tamil AI unavailable notice present: "${ta.intercrop.aiUnavailableNotice}"`);
assert(hi.intercrop.aiUnavailableNotice.includes("ऑफ़लाइन"), `Hindi AI unavailable notice present: "${hi.intercrop.aiUnavailableNotice}"`);

assert(ta.intercrop.incomeDisclaimer.includes("மாறுபடலாம்"), `Tamil income disclaimer present: "${ta.intercrop.incomeDisclaimer}"`);
assert(hi.intercrop.incomeDisclaimer.includes("भिन्न"), `Hindi income disclaimer present: "${hi.intercrop.incomeDisclaimer}"`);

// AI Assistant offline & error handling keys
assert(ta.aiAssistant.offlineError.includes("ஆஃப்லைனில்"), `Tamil AI Assistant offline error: "${ta.aiAssistant.offlineError}"`);
assert(hi.aiAssistant.offlineError.includes("ऑफ़लाइन"), `Hindi AI Assistant offline error: "${hi.aiAssistant.offlineError}"`);
assert(ta.aiAssistant.serviceError.includes("தற்காலிகமாக"), `Tamil AI Assistant service error: "${ta.aiAssistant.serviceError}"`);
assert(hi.aiAssistant.serviceError.includes("अनुपलब्ध"), `Hindi AI Assistant service error: "${hi.aiAssistant.serviceError}"`);
assert(ta.aiAssistant.disclaimer.includes("வழிகாட்டலுக்கு மட்டுமே"), `Tamil AI Assistant disclaimer: "${ta.aiAssistant.disclaimer}"`);
assert(hi.aiAssistant.disclaimer.includes("मार्गदर्शन"), `Hindi AI Assistant disclaimer: "${hi.aiAssistant.disclaimer}"`);

console.log("\n==================================================");
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================");

if (failed > 0) process.exit(1);
