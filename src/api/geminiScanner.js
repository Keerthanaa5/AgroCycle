import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey =
  import.meta.env.VITE_GEMINI_SCANNER_KEY ||
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.VITE_GEMINI_ASSISTANT_KEY ||
  import.meta.env.VITE_GEMINI_INTERCROP_KEY;

export async function analyzeClaimImage(imageBase64, cropType = "Crop", damageType = "flood") {
  try {
    if (!apiKey) throw new Error("Missing Gemini API Key");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const prompt = `You are an AI agricultural evidence review assistant helping a farmer prepare documentation for a crop insurance claim.
Analyze this crop damage evidence photo to assist in preparing a claim dossier.
Crop: ${cropType}
Reported Peril / Cause: ${damageType}

Evaluate the photographic evidence objectively.
IMPORTANT SAFETY RULES:
- Do NOT determine official insurance loss percentages, indemnity payout amounts, or claim eligibility decisions.
- Use cautious, preliminary terminology.
- Focus on image clarity, visible damage characteristics, evidence completeness, and surveyor readiness.

Return EXACTLY ONE valid JSON object:
{
  "image_quality": "good | adequate | needs_improvement",
  "crop_visible": true,
  "damage_indicators": "concise description of visible damage characteristics (e.g., foliage lodging, leaf discoloration, waterlogging)",
  "peril_consistency": "Consistent with reported peril | Inconclusive without physical field survey",
  "evidence_completeness": "Sufficient for preliminary claim dossier | Additional field-wide photographs recommended",
  "recommendation": "concise next-step guidance for farmer (e.g. intimate claim to insurer within 72 hours, retain photo for joint field survey)",
  "disclaimer": "Visual observations are for documentation assistance only and do not constitute an official insurance loss assessment or claim settlement decision."
}`;

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = imageBase64.match(/data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
    const imageParts = [{ inlineData: { data: base64Data, mimeType } }];
    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    const parsed = JSON.parse(responseText);
    parsed.assessment_source = "Cloud Vision AI (Gemini Evidence Review)";
    return parsed;
  } catch (error) {
    console.log("Cloud AI evidence review offline or unavailable:", error?.message);
    return null;
  }
}

