/**
 * AgroCycle Groq AI Service — Secondary Fallback for Intercrop Wizard & AI Assistant
 * 
 * Used EXCLUSIVELY as a secondary fallback provider when Gemini API fails
 * (e.g. rate limits, quota limits, model unavailability, network errors).
 * 
 * Provider Priority: Gemini (Primary) → Groq (Secondary) → Local Engine (Offline/Fallback)
 */

const GROQ_CANDIDATE_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "groq/compound-mini",
  "groq/compound"
];

/**
 * Safely retrieve Groq API key from environment
 */
function getGroqApiKey() {
  if (typeof import.meta === "undefined" || !import.meta.env) return null;
  return import.meta.env.VITE_GROQ_INTERCROP_KEY || import.meta.env.VITE_GROQ_API_KEY || null;
}

/**
 * Check if the browser currently has internet connectivity
 */
export function isOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine !== false : true;
}

/**
 * Internal helper to query Groq OpenAI-compatible Chat Completions API with model fallback
 */
async function callGroqApi({ apiKey, messages, responseFormat, signal }) {
  let lastError = null;

  for (const model of GROQ_CANDIDATE_MODELS) {
    try {
      const body = {
        model,
        messages,
        temperature: 0.2,
        max_tokens: 1500
      };
      if (responseFormat) {
        body.response_format = responseFormat;
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        signal,
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content;
        if (content) {
          return { ok: true, text: content, model };
        }
      } else {
        lastError = `http_${response.status}`;
        if (response.status === 401 || response.status === 403) {
          break;
        }
      }
    } catch (err) {
      lastError = err.name === "AbortError" ? "timeout" : err.message;
      if (err.name === "AbortError") break;
    }
  }

  return { ok: false, error: lastError || "groq_api_failed" };
}

/**
 * Generate AI-enhanced agronomic advice via Groq (Secondary Fallback)
 * 
 * @param {Object} params
 * @param {string} params.crop - Primary crop
 * @param {string} params.soil - Soil type
 * @param {string} params.season - Cultivation season
 * @param {string} params.location - Farm location / district
 * @param {number|string} params.acres - Land size in acres
 * @param {Object} params.baseRecommendation - Offline engine's baseline recommendation
 * @param {string} params.language - Selected language ('en', 'ta', 'hi')
 * @returns {Promise<{ success: boolean, isEnhanced: boolean, provider: string, data?: Object, error?: string }>}
 */
export async function generateGroqIntercropAdvice({
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
    return { success: false, isEnhanced: false, provider: "local", error: "offline" };
  }

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return { success: false, isEnhanced: false, provider: "local", error: "no_api_key" };
  }

  const langInstruction = language === "ta" 
    ? "Respond strictly in clear, natural agricultural Tamil (தமிழ்). Ensure farmer-friendly terminology."
    : (language === "hi" 
        ? "Respond strictly in clear, natural agricultural Hindi (हिन्दी). Ensure farmer-friendly terminology."
        : "Respond strictly in clear, farmer-friendly English.");

  const companionCropName = baseRecommendation?.suggestions?.[0]?.cropName || "Companion Crop";

  const systemInstruction = `You are the AgroCycle Agronomic Advisory AI assisting Indian farmers.
You are providing AI-assisted agricultural guidance, not an official agronomic certification. Do not invent precise yield, profit, chemical dosage, or guaranteed outcomes. Clearly distinguish estimates from facts. Consider local conditions and recommend confirmation with local agricultural experts when a decision could materially affect the farmer's crop or finances.

${langInstruction}

You must respond ONLY with a valid JSON object matching this exact schema:
{
  "why_it_may_fit": "Concise 1-2 sentence explanation of why this companion crop fits the soil, season, and primary crop.",
  "key_benefits": ["Benefit 1 regarding soil biology / pest deterrent", "Benefit 2 regarding crop synergy"],
  "risks_or_considerations": ["Key consideration 1 (e.g. moisture/spacing)", "Key consideration 2 (e.g. harvesting timing)"],
  "practical_advice": "1-2 practical field management tips for sowing and water management.",
  "when_to_consult_expert": "A brief reminder on when the farmer should consult the local Krishi Vigyan Kendra (KVK) or block agriculture officer."
}`;

  const userPrompt = `Farmer's Field Parameters:
- Primary Crop: ${crop}
- Soil Type: ${soil}
- Cultivation Season: ${season}
- Farm Location / District: ${location}
- Cultivated Area: ${acres} Acres
- Baseline Companion Recommendation: ${companionCropName}

Provide the structured agronomic enhancement in strict JSON.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const apiRes = await callGroqApi({
      apiKey,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt }
      ],
      responseFormat: { type: "json_object" },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!apiRes.ok || !apiRes.text) {
      return { success: false, isEnhanced: false, provider: "groq", error: apiRes.error || "api_error" };
    }

    const cleanedText = apiRes.text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsedData = JSON.parse(cleanedText);

    return {
      success: true,
      isEnhanced: true,
      provider: "groq",
      model: apiRes.model,
      data: parsedData
    };
  } catch (err) {
    return {
      success: false,
      isEnhanced: false,
      provider: "groq",
      error: err.name === "AbortError" ? "timeout" : (err.message || "api_error")
    };
  }
}

/**
 * Send conversational message to Groq AI Assistant (Secondary Fallback)
 * 
 * @param {Object} params
 * @param {string} params.message - User message
 * @param {Array} [params.history] - Previous chat messages
 * @param {string} [params.language] - Selected language ('en', 'ta', 'hi')
 * @param {Object} [params.context] - Optional safe field context
 * @returns {Promise<{ success: boolean, text?: string, model?: string, error?: string }>}
 */
export async function sendGroqAssistantMessage({
  message,
  history = [],
  language = "en",
  context = null
}) {
  if (!isOnline()) {
    return { success: false, error: "offline" };
  }

  const apiKey = getGroqApiKey();
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

  const safeHistory = history.slice(-6).map(h => ({
    role: h.role === "user" ? "user" : "assistant",
    content: h.content
  }));

  const messages = [
    { role: "system", content: systemInstruction },
    ...safeHistory,
    { role: "user", content: message }
  ];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const apiRes = await callGroqApi({
      apiKey,
      messages,
      responseFormat: null,
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
    return {
      success: false,
      error: err.name === "AbortError" ? "timeout" : (err.message || "api_error")
    };
  }
}
