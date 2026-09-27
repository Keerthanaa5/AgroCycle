/**
 * AgroCycle Centralized Gemini AI Service
 * 
 * Used EXCLUSIVELY for:
 * 1. Intercrop Wizard — online contextual agronomic enhancement
 * 2. AI Assistant — conversational farmer advisory
 * 
 * ALL other AgroCycle modules (YOLO11n, Decision Engine, Waste Matcher,
 * AgroConnect, Silage Bank, Carbon Cash, Claim Rocket, Sync, IndexedDB)
 * remain 100% LOCAL & OFFLINE.
 * 
 * PROTOTYPE NOTE: In this client-side prototype, API keys are accessed via
 * environment variables (import.meta.env). In a full production deployment,
 * these requests should route through a secure backend proxy.
 */

const GEMINI_CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest"
];

/**
 * Safely retrieve API key for the requested module
 */
function getApiKey(moduleType = "default") {
  if (typeof import.meta === "undefined" || !import.meta.env) return null;

  if (moduleType === "intercrop") {
    return (
      import.meta.env.VITE_GEMINI_INTERCROP_KEY ||
      import.meta.env.VITE_GEMINI_API_KEY ||
      import.meta.env.VITE_GEMINI_ASSISTANT_KEY ||
      import.meta.env.VITE_GEMINI_SCANNER_KEY ||
      null
    );
  }
  if (moduleType === "assistant") {
    return (
      import.meta.env.VITE_GEMINI_ASSISTANT_KEY ||
      import.meta.env.VITE_GEMINI_API_KEY ||
      import.meta.env.VITE_GEMINI_INTERCROP_KEY ||
      import.meta.env.VITE_GEMINI_SCANNER_KEY ||
      null
    );
  }
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GEMINI_ASSISTANT_KEY ||
    import.meta.env.VITE_GEMINI_INTERCROP_KEY ||
    import.meta.env.VITE_GEMINI_SCANNER_KEY ||
    null
  );
}

/**
 * Check if the browser currently has internet connectivity
 */
export function isOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine !== false : true;
}

/**
 * Internal helper to query Gemini API with model fallback
 */
async function callGeminiApi({ apiKey, contents, generationConfig, signal }) {
  let lastError = null;

  for (const model of GEMINI_CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ contents, generationConfig })
      });

      if (response.ok) {
        const json = await response.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { ok: true, text, model };
        }
      } else {
        lastError = `http_${response.status}`;
        // Only abort loop on fundamental authentication/forbidden errors
        if (response.status === 401 || response.status === 403) {
          break;
        }
        // On 503 (high demand), 429 (rate limit), 404 (model missing), continue to next candidate model
      }
    } catch (err) {
      lastError = err.name === "AbortError" ? "timeout" : err.message;
      if (err.name === "AbortError") break;
    }
  }

  return { ok: false, error: lastError || "api_failed" };
}

/**
 * Generate AI-enhanced agronomic advice for Intercrop Wizard
 * 
 * @param {Object} params
 * @param {string} params.crop - Primary crop
 * @param {string} params.soil - Soil type
 * @param {string} params.season - Cultivation season
 * @param {string} params.location - Farm location / district
 * @param {number|string} params.acres - Land size in acres
 * @param {Object} params.baseRecommendation - Offline engine's baseline recommendation
 * @param {string} params.language - Selected language ('en', 'ta', 'hi')
 * @returns {Promise<{ success: boolean, isEnhanced: boolean, data?: Object, error?: string }>}
 */
export async function generateIntercropAdvice({
  crop,
  soil,
  season,
  location,
  acres,
  baseRecommendation,
  language = "en"
}) {
  // 1. Immediate offline check
  if (!isOnline()) {
    return { success: false, isEnhanced: false, error: "offline" };
  }

  const apiKey = getApiKey("intercrop");
  if (!apiKey) {
    return { success: false, isEnhanced: false, error: "no_api_key" };
  }

  const langInstruction = language === "ta" 
    ? "Respond strictly in clear, natural agricultural Tamil (தமிழ்). Ensure farmer-friendly terminology."
    : (language === "hi" 
        ? "Respond strictly in clear, natural agricultural Hindi (हिन्दी). Ensure farmer-friendly terminology."
        : "Respond strictly in clear, farmer-friendly English.");

  const companionCropName = baseRecommendation?.suggestions?.[0]?.cropName || "Companion Crop";

  const systemPrompt = `You are the AgroCycle Agronomic Advisory AI assisting Indian farmers.
You are providing AI-assisted agricultural guidance, not an official agronomic certification. Do not invent precise yield, profit, chemical dosage, or guaranteed outcomes. Clearly distinguish estimates from facts. Consider local conditions and recommend confirmation with local agricultural experts when a decision could materially affect the farmer's crop or finances.

${langInstruction}

Given the farmer's field parameters:
- Primary Crop: ${crop}
- Soil Type: ${soil}
- Cultivation Season: ${season}
- Farm Location / District: ${location}
- Cultivated Area: ${acres} Acres
- Baseline Companion Recommendation: ${companionCropName}

Provide an agronomic enhancement in strict valid JSON format with the following keys:
{
  "why_it_may_fit": "Concise 1-2 sentence explanation of why this companion crop fits the soil, season, and primary crop.",
  "key_benefits": ["Benefit 1 regarding soil biology / pest deterrent", "Benefit 2 regarding crop synergy"],
  "risks_or_considerations": ["Key consideration 1 (e.g. moisture/spacing)", "Key consideration 2 (e.g. harvesting timing)"],
  "practical_advice": "1-2 practical field management tips for sowing and water management.",
  "when_to_consult_expert": "A brief reminder on when the farmer should consult the local Krishi Vigyan Kendra (KVK) or block agriculture officer."
}

Return ONLY the raw JSON object without markdown formatting or code blocks.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const apiRes = await callGeminiApi({
      apiKey,
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!apiRes.ok || !apiRes.text) {
      return { success: false, isEnhanced: false, error: apiRes.error || "api_error" };
    }

    // Clean any markdown code fences if returned by model
    const cleanedText = apiRes.text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsedData = JSON.parse(cleanedText);

    return {
      success: true,
      isEnhanced: true,
      provider: "gemini",
      model: apiRes.model,
      data: parsedData
    };
  } catch (err) {
    console.warn("Gemini Intercrop Enhancement fallback:", err.message);
    return {
      success: false,
      isEnhanced: false,
      provider: "gemini",
      error: err.name === "AbortError" ? "timeout" : (err.message || "api_error")
    };
  }
}

/**
 * Send conversational message to Gemini AI Assistant
 * 
 * @param {Object} params
 * @param {string} params.message - User message
 * @param {Array} [params.history] - Previous chat messages
 * @param {string} [params.language] - Selected language ('en', 'ta', 'hi')
 * @param {Object} [params.context] - Optional safe field context (e.g. recent scan results)
 * @returns {Promise<{ success: boolean, text?: string, model?: string, error?: string }>}
 */
export async function sendAssistantMessage({
  message,
  history = [],
  language = "en",
  context = null
}) {
  if (!isOnline()) {
    return { success: false, error: "offline" };
  }

  const apiKey = getApiKey("assistant");
  if (!apiKey) {
    return { success: false, error: "no_api_key" };
  }

  const langInstruction = language === "ta"
    ? "Respond strictly in natural, polite agricultural Tamil (தமிழ்)."
    : (language === "hi"
        ? "Respond strictly in natural, polite agricultural Hindi (हिन्दी)."
        : "Respond strictly in clear, polite English.");

  let contextSnippet = "";
  if (context && typeof context === "object") {
    if (context.cropName) contextSnippet += `\n- Farmer's Cultivated Crop: ${context.cropName}`;
    if (context.primaryDisease) contextSnippet += `\n- Recent Visual Scanner Finding: ${context.primaryDisease} (${context.diseaseBurdenScore}% burden)`;
    if (context.recommendedPathway) contextSnippet += `\n- Recommended Recovery Pathway: ${context.recommendedPathway}`;
  }

  const systemInstruction = `You are the AgroCycle AI Agricultural Assistant helping Indian farmers.
You provide helpful, practical, and empathetic farming advice in the user's selected language.
You are providing AI-assisted agricultural guidance, not an official government certification, insurance claim assessment, or chemical prescription.
Do not invent official insurance payouts or certified loss percentages.
When discussing high-stakes decisions, encourage consulting local agricultural extension officers or Krishi Vigyan Kendra (KVK).
Keep responses concise, clear, and structured with bullet points where helpful.
${contextSnippet ? `\nFarmer context:${contextSnippet}` : ""}
\n${langInstruction}`;

  // Build conversation contents (limit to last 6 turns for speed & context safety)
  const safeHistory = history.slice(-6).map(h => ({
    role: h.role === "user" ? "user" : "model",
    parts: [{ text: h.content }]
  }));

  const contents = [
    {
      role: "user",
      parts: [{ text: systemInstruction }]
    },
    {
      role: "model",
      parts: [{ text: "Understood. I am ready to assist the farmer with helpful, safe agricultural guidance." }]
    },
    ...safeHistory,
    {
      role: "user",
      parts: [{ text: message }]
    }
  ];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const apiRes = await callGeminiApi({
      apiKey,
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!apiRes.ok || !apiRes.text) {
      return { success: false, error: apiRes.error || "api_error" };
    }

    return {
      success: true,
      model: apiRes.model,
      text: apiRes.text.trim()
    };
  } catch (err) {
    console.warn("Gemini Assistant error:", err.message);
    return {
      success: false,
      error: err.name === "AbortError" ? "timeout" : (err.message || "api_error")
    };
  }
}
