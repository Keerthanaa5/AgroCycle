/**
 * AgroCycle YOLO11n Localized Disease & Crop Display Dictionary
 * 
 * IMPORTANT ARCHITECTURAL RULES:
 * 1. Internal YOLO class identifiers (e.g. "tomato_early_blight_leaf") MUST NEVER CHANGE.
 * 2. Model tensor inputs, outputs, class IDs, coordinates, and confidence calculations are preserved.
 * 3. This dictionary maps internal raw identifiers to farmer-friendly localized presentation labels.
 * 4. Safe fallbacks guarantee that unknown or future model classes will never crash or return null/undefined.
 */

export const YOLO_DISEASE_LABELS = {
  bell_pepper_leaf: {
    en: "Bell Pepper Foliage",
    ta: "குடைமிளகாய் இலை",
    hi: "शिमला मिर्च पत्ती",
    crop: { en: "Bell Pepper", ta: "குடைமிளகாய்", hi: "शिमला मिर्च" },
    isDisease: false,
    diseaseName: {
      en: "No disease-specific indicator detected",
      ta: "குறிப்பிட்ட நோய் அறிகுறிகள் எதுவும் கண்டறியப்படவில்லை",
      hi: "कोई विशिष्ट रोग संकेत नहीं पाया गया"
    }
  },
  bell_pepper_leaf_spot: {
    en: "Bell Pepper Bacterial Spot",
    ta: "குடைமிளகாய் பாக்டீரியா இலைப்புள்ளி",
    hi: "शिमला मिर्च जीवाणु पत्ती धब्बा",
    crop: { en: "Bell Pepper", ta: "குடைமிளகாய்", hi: "शिमला मिर्च" },
    isDisease: true,
    diseaseName: {
      en: "Bacterial/Fungal Leaf Spot",
      ta: "பாக்டீரியா / பூஞ்சை இலைப்புள்ளி நோய்",
      hi: "जीवाणु / कवक पत्ती धब्बा रोग"
    }
  },
  corn_gray_leaf_spot: {
    en: "Corn Gray Leaf Spot",
    ta: "மக்காச்சோளம் சாம்பல் இலைப்புள்ளி நோய்",
    hi: "मक्का ग्रे लीफ स्पॉट (धूसर पत्ती धब्बा)",
    crop: { en: "Corn", ta: "மக்காச்சோளம்", hi: "मक्का" },
    isDisease: true,
    diseaseName: {
      en: "Cercospora Gray Leaf Spot",
      ta: "செர்கோஸ்போரா சாம்பல் இலைப்புள்ளி",
      hi: "सर्कोस्पोरा ग्रे लीफ स्पॉट"
    }
  },
  corn_leaf_blight: {
    en: "Corn Leaf Blight",
    ta: "மக்காச்சோளம் இலைக் கருகல் நோய்",
    hi: "मक्का पत्ती झुलसा रोग",
    crop: { en: "Corn", ta: "மக்காச்சோளம்", hi: "मक्का" },
    isDisease: true,
    diseaseName: {
      en: "Northern/Southern Leaf Blight",
      ta: "வடக்கு/தெற்கு இலைக் கருகல்",
      hi: "उत्तरी / दक्षिणी पत्ती झुलसा"
    }
  },
  corn_rust: {
    en: "Corn Rust",
    ta: "மக்காச்சோளம் துரு நோய்",
    hi: "मक्का रतुआ (रस्ट) रोग",
    crop: { en: "Corn", ta: "மக்காச்சோளம்", hi: "मक्का" },
    isDisease: true,
    diseaseName: {
      en: "Common Rust (Puccinia)",
      ta: "பொதுவான துரு நோய் (பக்சீனியா)",
      hi: "सामान्य रतुआ रोग (पक्सिनिया)"
    }
  },
  corn_rust_leaf: {
    en: "Corn Rust",
    ta: "மக்காச்சோளம் துரு நோய்",
    hi: "मक्का रतुआ (रस्ट) रोग",
    crop: { en: "Corn", ta: "மக்காச்சோளம்", hi: "मक्का" },
    isDisease: true,
    diseaseName: {
      en: "Common Rust (Puccinia)",
      ta: "பொதுவான துரு நோய் (பக்சீனியா)",
      hi: "सामान्य रतुआ रोग (पक्सिनिया)"
    }
  },
  corn_healthy: {
    en: "Corn Foliage",
    ta: "மக்காச்சோளம் இலை",
    hi: "मक्का पत्ती",
    crop: { en: "Corn", ta: "மக்காச்சோளம்", hi: "मक्का" },
    isDisease: false,
    diseaseName: {
      en: "No disease-specific indicator detected",
      ta: "குறிப்பிட்ட நோய் அறிகுறிகள் எதுவும் கண்டறியப்படவில்லை",
      hi: "कोई विशिष्ट रोग संकेत नहीं पाया गया"
    }
  },
  potato_leaf: {
    en: "Potato Foliage",
    ta: "உருளைக்கிழங்கு இலை",
    hi: "आलू पत्ती",
    crop: { en: "Potato", ta: "உருளைக்கிழங்கு", hi: "आलू" },
    isDisease: false,
    diseaseName: {
      en: "No disease-specific indicator detected",
      ta: "குறிப்பிட்ட நோய் அறிகுறிகள் எதுவும் கண்டறியப்படவில்லை",
      hi: "कोई विशिष्ट रोग संकेत नहीं पाया गया"
    }
  },
  potato_leaf_early_blight: {
    en: "Potato Early Blight",
    ta: "உருளைக்கிழங்கு ஆரம்ப கருகல் நோய்",
    hi: "आलू अगेती झुलसा (अर्ली ब्लाइट)",
    crop: { en: "Potato", ta: "உருளைக்கிழங்கு", hi: "आलू" },
    isDisease: true,
    diseaseName: {
      en: "Early Blight (Alternaria solani)",
      ta: "ஆரம்ப கருகல் நோய் (ஆல்டர்நேரியா)",
      hi: "अगेती झुलसा (अल्टरनेरिया सोलानी)"
    }
  },
  potato_leaf_late_blight: {
    en: "Potato Late Blight",
    ta: "உருளைக்கிழங்கு தாமத கருகல் நோய்",
    hi: "आलू पछेती झुलसा (लेट ब्लाइट)",
    crop: { en: "Potato", ta: "உருளைக்கிழங்கு", hi: "आलू" },
    isDisease: true,
    diseaseName: {
      en: "Late Blight (Phytophthora infestans)",
      ta: "தாமத கருகல் நோய் (பைட்டோப்தோரா)",
      hi: "पछेती झुलसा (फाइटोफ्थोरा इन्फेस्टन्स)"
    }
  },
  soyabean_leaf: {
    en: "Soybean Foliage",
    ta: "சோயாபீன் இலை",
    hi: "सोयाबीन पत्ती",
    crop: { en: "Soybean", ta: "சோயாபீன்", hi: "सोयाबीन" },
    isDisease: false,
    diseaseName: {
      en: "No disease-specific indicator detected",
      ta: "குறிப்பிட்ட நோய் அறிகுறிகள் எதுவும் கண்டறியப்படவில்லை",
      hi: "कोई विशिष्ट रोग संकेत नहीं पाया गया"
    }
  },
  squash_powdery_mildew_leaf: {
    en: "Squash Powdery Mildew",
    ta: "பூசணி சாம்பல் நோய்",
    hi: "कद्दू पाउडरी फफूंदी (चूर्णिल आसिता)",
    crop: { en: "Squash", ta: "பூசணி", hi: "कद्दू" },
    isDisease: true,
    diseaseName: {
      en: "Powdery Mildew (Erysiphaceae)",
      ta: "சாம்பல் பூஞ்சை நோய் (எரிசிஃபேசி)",
      hi: "पाउडरी मिल्ड्यू (चूर्णिल फफूंद)"
    }
  },
  tomato_early_blight_leaf: {
    en: "Tomato Early Blight",
    ta: "தக்காளி ஆரம்ப கருகல் நோய்",
    hi: "टमाटर अगेती झुलसा (अर्ली ब्लाइट)",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Early Blight (Alternaria solani)",
      ta: "ஆரம்ப கருகல் நோய் (ஆல்டர்நேரியா)",
      hi: "अगेती झुलसा (अल्टरनेरिया सोलानी)"
    }
  },
  tomato_late_blight_leaf: {
    en: "Tomato Late Blight",
    ta: "தக்காளி தாமத கருகல் நோய்",
    hi: "टमाटर पछेती झुलसा (लेट ब्लाइट)",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Late Blight (Phytophthora infestans)",
      ta: "தாமத கருகல் நோய் (பைட்டோப்தோரா)",
      hi: "पछेती झुलसा (फाइटोफ्थोरा इन्फेस्टन्स)"
    }
  },
  tomato_leaf_late_blight: {
    en: "Tomato Late Blight",
    ta: "தக்காளி தாமத கருகல் நோய்",
    hi: "टमाटर पछेती झुलसा (लेट ब्लाइट)",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Late Blight (Phytophthora infestans)",
      ta: "தாமத கருகல் நோய் (பைட்டோப்தோரா)",
      hi: "पछेती झुलसा (फाइटोफ्थोरा इन्फेस्टन्स)"
    }
  },
  tomato_septoria_leaf_spot: {
    en: "Tomato Septoria Leaf Spot",
    ta: "தக்காளி செப்டோரியா இலைப்புள்ளி நோய்",
    hi: "टमाटर सेप्टोरिया पत्ती धब्बा रोग",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Septoria Leaf Spot (Septoria lycopersici)",
      ta: "செப்டோரியா இலைப்புள்ளி நோய்",
      hi: "सेप्टोरिया पत्ती धब्बा"
    }
  },
  tomato_leaf: {
    en: "Tomato Foliage",
    ta: "தக்காளி இலை",
    hi: "टमाटर पत्ती",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: false,
    diseaseName: {
      en: "No disease-specific indicator detected",
      ta: "குறிப்பிட்ட நோய் அறிகுறிகள் எதுவும் கண்டறியப்படவில்லை",
      hi: "कोई विशिष्ट रोग संकेत नहीं पाया गया"
    }
  },
  tomato_leaf_bacterial_spot: {
    en: "Tomato Bacterial Spot",
    ta: "தக்காளி பாக்டீரியா இலைப்புள்ளி நோய்",
    hi: "टमाटर जीवाणु पत्ती धब्बा रोग",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Bacterial Spot (Xanthomonas)",
      ta: "பாக்டீரியா இலைப்புள்ளி (சாந்தோமோனாஸ்)",
      hi: "जीवाणु पत्ती धब्बा (जैंथोमोनास)"
    }
  },
  tomato_leaf_mosaic_virus: {
    en: "Tomato Mosaic Virus",
    ta: "தக்காளி மொசைக் வைரஸ் நோய்",
    hi: "टमाटर मोज़ेक वायरस रोग",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Tomato Mosaic Virus (ToMV)",
      ta: "தக்காளி மொசைக் வைரஸ் (ToMV)",
      hi: "टमाटर मोज़ेक वायरस (ToMV)"
    }
  },
  tomato_mosaic_virus: {
    en: "Tomato Mosaic Virus",
    ta: "தக்காளி மொசைக் வைரஸ் நோய்",
    hi: "टमाटर मोज़ेक वायरस रोग",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Tomato Mosaic Virus (ToMV)",
      ta: "தக்காளி மொசைக் வைரஸ் (ToMV)",
      hi: "टमाटर मोज़ेक वायरस (ToMV)"
    }
  },
  tomato_leaf_yellow_virus: {
    en: "Tomato Yellow Leaf Curl Virus",
    ta: "தக்காளி மஞ்சள் இலைச்சுருள் வைரஸ்",
    hi: "टमाटर पीली पत्ती मरोड़ वायरस",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Yellow Leaf Curl Virus (TYLCV)",
      ta: "மஞ்சள் இலைச்சுருள் வைரஸ் (TYLCV)",
      hi: "पीली पत्ती मरोड़ वायरस (TYLCV)"
    }
  },
  tomato_yellow_leaf_curl_virus: {
    en: "Tomato Yellow Leaf Curl Virus",
    ta: "தக்காளி மஞ்சள் இலைச்சுருள் வைரஸ்",
    hi: "टमाटर पीली पत्ती मरोड़ वायरस",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Yellow Leaf Curl Virus (TYLCV)",
      ta: "மஞ்சள் இலைச்சுருள் வைரஸ் (TYLCV)",
      hi: "पीली पत्ती मरोड़ वायरस (TYLCV)"
    }
  },
  tomato_mold_leaf: {
    en: "Tomato Leaf Mold",
    ta: "தக்காளி இலை பூஞ்சை காளான் நோய்",
    hi: "टमाटर पत्ती फफूंद (लीफ मोल्ड) रोग",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Leaf Mold (Passalora fulva)",
      ta: "இலை பூஞ்சை காளான் நோய் (பாசலோரா)",
      hi: "लीफ मोल्ड फफूंद (पासालोरा)"
    }
  },
  tomato_leaf_mold: {
    en: "Tomato Leaf Mold",
    ta: "தக்காளி இலை பூஞ்சை காளான் நோய்",
    hi: "टमाटर पत्ती फफूंद (लीफ मोल्ड) रोग",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Leaf Mold (Passalora fulva)",
      ta: "இலை பூஞ்சை காளான் நோய் (பாசலோரா)",
      hi: "लीफ मोल्ड फफूंद (पासालोरा)"
    }
  },
  tomato_spider_mites: {
    en: "Tomato Spider Mites",
    ta: "தக்காளி சிலந்திப் பூச்சிகள் தாக்குதல்",
    hi: "टमाटर मकड़ी कीट (स्पाइडर माइट्स) प्रकोप",
    crop: { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
    isDisease: true,
    diseaseName: {
      en: "Two-spotted Spider Mite (Tetranychus urticae)",
      ta: "புள்ளி சிலந்திப் பூச்சி (டெட்ரானிகஸ்)",
      hi: "दो-धब्बेदार मकड़ी कीट (टेट्रानिकस)"
    }
  },
  grape_leaf: {
    en: "Grape Foliage",
    ta: "திராட்சை இலை",
    hi: "अंगूर पत्ती",
    crop: { en: "Grape", ta: "திராட்சை", hi: "अंगूर" },
    isDisease: false,
    diseaseName: {
      en: "No disease-specific indicator detected",
      ta: "குறிப்பிட்ட நோய் அறிகுறிகள் எதுவும் கண்டறியப்படவில்லை",
      hi: "कोई विशिष्ट रोग संकेत नहीं पाया गया"
    }
  },
  grape_leaf_black_rot: {
    en: "Grape Black Rot",
    ta: "திராட்சை கறுப்பு அழுகல் நோய்",
    hi: "अंगूर काला सड़न (ब्लैक रॉट) रोग",
    crop: { en: "Grape", ta: "திராட்சை", hi: "अंगूर" },
    isDisease: true,
    diseaseName: {
      en: "Black Rot (Guignardia bidwellii)",
      ta: "கறுப்பு அழுகல் நோய் (குயிக்னார்டியா)",
      hi: "ब्लैक रॉट सड़न (गुइग्नार्डिया)"
    }
  }
};

export const CROP_NAMES = {
  "Bell Pepper": { en: "Bell Pepper", ta: "குடைமிளகாய்", hi: "शिमला मिर्च" },
  "Corn": { en: "Corn", ta: "மக்காச்சோளம்", hi: "मक्का" },
  "Potato": { en: "Potato", ta: "உருளைக்கிழங்கு", hi: "आलू" },
  "Soybean": { en: "Soybean", ta: "சோயாபீன்", hi: "सोयाबीन" },
  "Squash": { en: "Squash", ta: "பூசணி", hi: "कद्दू" },
  "Tomato": { en: "Tomato", ta: "தக்காளி", hi: "टमाटर" },
  "Grape": { en: "Grape", ta: "திராட்சை", hi: "अंगूर" },
  "Rice": { en: "Rice / Paddy", ta: "நெல்", hi: "धान / चावल" },
  "Paddy": { en: "Paddy", ta: "நெல்", hi: "धान" },
  "Cotton": { en: "Cotton", ta: "பருத்தி", hi: "கபாஸ் / कपास" },
  "Sugarcane": { en: "Sugarcane", ta: "கரும்பு", hi: "गन्ना" },
  "Groundnut": { en: "Groundnut", ta: "நிலக்கடலை", hi: "मूंगफली" },
  "Maize": { en: "Maize", ta: "மக்காச்சோளம்", hi: "मक्का" },
  "Wheat": { en: "Wheat", ta: "கோதுமை", hi: "गेहूं" },
  "Pulses": { en: "Pulses / Legumes", ta: "பயறு வகைகள்", hi: "दालें / फलियां" }
};

/**
 * Format an unmapped raw class name into a clean, human-readable English string
 */
function humanizeIdentifier(rawName) {
  if (!rawName) return "Unspecified Crop Foliage";
  return String(rawName)
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Safely retrieve the localized display label for a YOLO class.
 * Never throws, never returns undefined or null.
 * 
 * @param {string} rawName - Internal YOLO raw class name (e.g. "tomato_early_blight_leaf")
 * @param {string} [language="en"] - Language code: "en" | "ta" | "hi"
 * @returns {string} Localized display string
 */
export function getDiseaseLabel(rawName, language = "en") {
  if (!rawName) return humanizeIdentifier(rawName);

  const key = String(rawName).trim().toLowerCase();
  const entry = YOLO_DISEASE_LABELS[key];

  if (entry) {
    if (entry[language]) return entry[language];
    if (entry.en) return entry.en;
  }

  // Fallback to formatted identifier
  return humanizeIdentifier(rawName);
}

/**
 * Safely retrieve the localized scientific/specific disease name.
 * 
 * @param {string} rawName - Internal YOLO raw class name
 * @param {string} [language="en"] - Language code: "en" | "ta" | "hi"
 * @returns {string} Localized disease scientific name or clean fallback
 */
export function getScientificDiseaseName(rawName, language = "en") {
  if (!rawName) return "";

  const key = String(rawName).trim().toLowerCase();
  const entry = YOLO_DISEASE_LABELS[key];

  if (entry && entry.diseaseName) {
    if (entry.diseaseName[language]) return entry.diseaseName[language];
    if (entry.diseaseName.en) return entry.diseaseName.en;
  }

  return getDiseaseLabel(rawName, language);
}

/**
 * Safely retrieve the localized crop name.
 * 
 * @param {string} cropName - Crop name in English (e.g. "Tomato", "Potato")
 * @param {string} [language="en"] - Language code: "en" | "ta" | "hi"
 * @returns {string} Localized crop name
 */
export function getCropLabel(cropName, language = "en") {
  if (!cropName) return "Crop";
  const direct = CROP_NAMES[cropName];
  if (direct) {
    return direct[language] || direct.en || cropName;
  }
  // Case-insensitive match check
  const matchedKey = Object.keys(CROP_NAMES).find(
    k => k.toLowerCase() === String(cropName).toLowerCase().trim()
  );
  if (matchedKey) {
    const entry = CROP_NAMES[matchedKey];
    return entry[language] || entry.en || cropName;
  }
  return cropName;
}
