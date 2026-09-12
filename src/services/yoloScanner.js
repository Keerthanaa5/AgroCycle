import * as ort from "onnxruntime-web";

// Configure WASM paths with exact matching installed version 1.29.0
const ORT_VERSION = "1.29.0";
if (typeof window !== "undefined") {
  ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
  ort.env.wasm.numThreads = 1;
}

export const YOLO_CLASSES = [
  { id: 0, rawName: "bell_pepper_leaf", crop: "Bell Pepper", displayName: "Bell Pepper (Leaf / Condition Unspecified)", isDisease: false, severity: "none", diseaseName: null },
  { id: 1, rawName: "bell_pepper_leaf_spot", crop: "Bell Pepper", displayName: "Bell Pepper Leaf Spot", isDisease: true, severity: "medium", diseaseName: "Bacterial/Fungal Leaf Spot" },
  { id: 2, rawName: "corn_gray_leaf_spot", crop: "Corn", displayName: "Corn Gray Leaf Spot", isDisease: true, severity: "medium", diseaseName: "Cercospora Gray Leaf Spot" },
  { id: 3, rawName: "corn_leaf_blight", crop: "Corn", displayName: "Corn Leaf Blight", isDisease: true, severity: "high", diseaseName: "Northern/Southern Leaf Blight" },
  { id: 4, rawName: "corn_rust_leaf", crop: "Corn", displayName: "Corn Rust", isDisease: true, severity: "medium", diseaseName: "Common Rust" },
  { id: 5, rawName: "potato_leaf_early_blight", crop: "Potato", displayName: "Potato Early Blight", isDisease: true, severity: "medium", diseaseName: "Early Blight (Alternaria)" },
  { id: 6, rawName: "potato_leaf_late_blight", crop: "Potato", displayName: "Potato Late Blight", isDisease: true, severity: "critical", diseaseName: "Late Blight (Phytophthora)" },
  { id: 7, rawName: "soyabean_leaf", crop: "Soybean", displayName: "Soybean (Leaf / Condition Unspecified)", isDisease: false, severity: "none", diseaseName: null },
  { id: 8, rawName: "squash_powdery_mildew_leaf", crop: "Squash", displayName: "Squash Powdery Mildew", isDisease: true, severity: "medium", diseaseName: "Powdery Mildew" },
  { id: 9, rawName: "tomato_early_blight_leaf", crop: "Tomato", displayName: "Tomato Early Blight", isDisease: true, severity: "medium", diseaseName: "Early Blight (Alternaria)" },
  { id: 10, rawName: "tomato_septoria_leaf_spot", crop: "Tomato", displayName: "Tomato Septoria Leaf Spot", isDisease: true, severity: "medium", diseaseName: "Septoria Leaf Spot" },
  { id: 11, rawName: "tomato_leaf", crop: "Tomato", displayName: "Tomato (Leaf / Condition Unspecified)", isDisease: false, severity: "none", diseaseName: null },
  { id: 12, rawName: "tomato_leaf_bacterial_spot", crop: "Tomato", displayName: "Tomato Bacterial Spot", isDisease: true, severity: "medium", diseaseName: "Bacterial Spot" },
  { id: 13, rawName: "tomato_leaf_late_blight", crop: "Tomato", displayName: "Tomato Late Blight", isDisease: true, severity: "critical", diseaseName: "Late Blight (Phytophthora)" },
  { id: 14, rawName: "tomato_leaf_mosaic_virus", crop: "Tomato", displayName: "Tomato Mosaic Virus", isDisease: true, severity: "high", diseaseName: "Mosaic Virus (ToMV)" },
  { id: 15, rawName: "tomato_leaf_yellow_virus", crop: "Tomato", displayName: "Tomato Yellow Leaf Curl Virus", isDisease: true, severity: "high", diseaseName: "Yellow Leaf Curl Virus (TYLCV)" },
  { id: 16, rawName: "tomato_mold_leaf", crop: "Tomato", displayName: "Tomato Leaf Mold", isDisease: true, severity: "medium", diseaseName: "Leaf Mold (Passalora)" },
  { id: 17, rawName: "grape_leaf", crop: "Grape", displayName: "Grape (Leaf / Condition Unspecified)", isDisease: false, severity: "none", diseaseName: null },
  { id: 18, rawName: "grape_leaf_black_rot", crop: "Grape", displayName: "Grape Black Rot", isDisease: true, severity: "critical", diseaseName: "Black Rot (Guignardia)" }
];

export const MODEL_PATH = "/models/agrocycle_yolo11n.onnx";

let sessionInstance = null;
let sessionLoadingPromise = null;

/**
 * Lazy singleton loader for ONNX inference session
 */
export async function getYOLOSession() {
  if (sessionInstance) {
    return sessionInstance;
  }
  if (sessionLoadingPromise) {
    return sessionLoadingPromise;
  }

  sessionLoadingPromise = (async () => {
    try {
      if (typeof window !== "undefined") {
        ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
        ort.env.wasm.numThreads = 1;
      }

      // Fetch model binary as ArrayBuffer for maximum stability across browsers
      const response = await fetch(MODEL_PATH);
      if (!response.ok) {
        throw new Error(`Failed to fetch model from ${MODEL_PATH} (Status ${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const modelBytes = new Uint8Array(arrayBuffer);

      const session = await ort.InferenceSession.create(modelBytes, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all"
      });
      sessionInstance = session;
      return session;
    } catch (err) {
      sessionLoadingPromise = null;
      console.error("Failed to load YOLO ONNX session:", err);
      throw new Error(`AI model failed to load from ${MODEL_PATH}: ${err.message || err}`);
    }
  })();

  return sessionLoadingPromise;
}

/**
 * Helper to load an image source (data URL, blob, or HTMLImageElement) into an Image object
 */
function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    if (source instanceof HTMLImageElement && source.complete && source.naturalWidth > 0) {
      resolve(source);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Failed to decode image file for AI scanning."));
    img.src = typeof source === "string" ? source : (source.src || URL.createObjectURL(source));
  });
}

/**
 * Preprocess image with 640x640 aspect-ratio letterbox into planar RGB float32 tensor
 */
export async function preprocessImage(imageSource) {
  const img = await loadImageElement(imageSource);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  if (!origW || !origH) {
    throw new Error("Invalid image dimensions for AI inference.");
  }

  const targetSize = 640;
  const scale = Math.min(targetSize / origW, targetSize / origH);
  const newW = Math.round(origW * scale);
  const newH = Math.round(origH * scale);
  const padX = Math.floor((targetSize - newW) / 2);
  const padY = Math.floor((targetSize - newH) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Letterbox background padding (114, 114, 114) standard for YOLO
  ctx.fillStyle = "rgb(114, 114, 114)";
  ctx.fillRect(0, 0, targetSize, targetSize);
  ctx.drawImage(img, padX, padY, newW, newH);

  const imgData = ctx.getImageData(0, 0, targetSize, targetSize);
  const { data } = imgData;

  const totalPixels = targetSize * targetSize;
  const floatArray = new Float32Array(3 * totalPixels);

  // Planar NCHW [1, 3, 640, 640], RGB normalized to [0, 1]
  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    floatArray[i] = r;                              // Channel 0 (Red)
    floatArray[totalPixels + i] = g;                // Channel 1 (Green)
    floatArray[totalPixels * 2 + i] = b;            // Channel 2 (Blue)
  }

  const tensor = new ort.Tensor("float32", floatArray, [1, 3, targetSize, targetSize]);

  return {
    tensor,
    transform: {
      origW,
      origH,
      scale,
      padX,
      padY,
      targetSize
    }
  };
}

/**
 * Compute Intersection over Union (IoU) between two bounding boxes [x1, y1, x2, y2]
 */
function calculateIoU(box1, box2) {
  const x1 = Math.max(box1[0], box2[0]);
  const y1 = Math.max(box1[1], box2[1]);
  const x2 = Math.min(box1[2], box2[2]);
  const y2 = Math.min(box1[3], box2[3]);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = (box1[2] - box1[0]) * (box1[3] - box1[1]);
  const area2 = (box2[2] - box2[0]) * (box2[3] - box2[1]);
  const union = area1 + area2 - intersection;

  return union > 0 ? intersection / union : 0;
}

/**
 * Parse output tensor [1, 23, 8400], un-letterbox coordinates, and perform NMS
 */
export function postprocessYOLO(outputTensor, transform, confThreshold = 0.25, iouThreshold = 0.45) {
  const { data } = outputTensor;
  const numAnchors = 8400;
  const numClasses = 19;
  const { origW, origH, scale, padX, padY } = transform;

  const candidates = [];

  for (let i = 0; i < numAnchors; i++) {
    let maxScore = -Infinity;
    let maxClass = -1;

    for (let c = 0; c < numClasses; c++) {
      const score = data[(4 + c) * numAnchors + i];
      if (score > maxScore) {
        maxScore = score;
        maxClass = c;
      }
    }

    if (maxScore >= confThreshold) {
      const cx = data[0 * numAnchors + i];
      const cy = data[1 * numAnchors + i];
      const w = data[2 * numAnchors + i];
      const h = data[3 * numAnchors + i];

      // Convert from 640x640 letterbox space back to original image coordinates
      const x1 = Math.max(0, Math.min(origW, (cx - w / 2 - padX) / scale));
      const y1 = Math.max(0, Math.min(origH, (cy - h / 2 - padY) / scale));
      const x2 = Math.max(0, Math.min(origW, (cx + w / 2 - padX) / scale));
      const y2 = Math.max(0, Math.min(origH, (cy + h / 2 - padY) / scale));

      const classMeta = YOLO_CLASSES[maxClass] || {
        id: maxClass,
        rawName: `class_${maxClass}`,
        crop: "Crop",
        displayName: `Class ${maxClass}`,
        isDisease: false,
        severity: "none"
      };

      candidates.push({
        classId: maxClass,
        rawName: classMeta.rawName,
        displayName: classMeta.displayName,
        crop: classMeta.crop,
        isDisease: classMeta.isDisease,
        severity: classMeta.severity,
        diseaseName: classMeta.diseaseName,
        confidence: Number(maxScore.toFixed(4)),
        box: [Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2)]
      });
    }
  }

  // Sort descending by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Non-Maximum Suppression (NMS)
  const finalDetections = [];
  for (const candidate of candidates) {
    let shouldKeep = true;
    for (const accepted of finalDetections) {
      if (calculateIoU(candidate.box, accepted.box) > iouThreshold) {
        shouldKeep = false;
        break;
      }
    }
    if (shouldKeep) {
      finalDetections.push(candidate);
    }
  }

  return finalDetections;
}

/**
 * Confidence category calculation:
 * - confidence < 0.50 -> Low
 * - confidence >= 0.50 AND < 0.75 -> Moderate
 * - confidence >= 0.75 -> High
 */
export function getConfidenceCategory(confidence) {
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.50) return "Moderate";
  return "Low";
}

/**
 * Disease Burden Categories:
 * - 0 -> No visual disease indicator detected
 * - 1–25 -> Low
 * - 26–50 -> Moderate
 * - 51–75 -> High
 * - 76–100 -> Critical
 */
export function getBurdenCategory(burdenScore) {
  if (burdenScore === 0) return "No visual disease indicator detected";
  if (burdenScore <= 25) return "Low";
  if (burdenScore <= 50) return "Moderate";
  if (burdenScore <= 75) return "High";
  return "Critical";
}

/**
 * Translates structured YOLO detections into agricultural viability metrics,
 * combining detection confidence, detection count, and spatial bounding box coverage.
 */
export function computeViabilityAssessment(detections, cropTypeHint = "", origDimensions = { width: 0, height: 0 }) {
  const diseaseDetections = detections.filter(d => d.isDisease);
  const unspecifiedLeafDetections = detections.filter(d => !d.isDisease);

  // 1. Determine dominant crop & strongest relevant disease detection
  let maxDetectionConfidence = 0;
  let highestConfidenceDisease = null;
  let dominantCrop = cropTypeHint || "Crop";
  let primaryDisease = null;

  if (diseaseDetections.length > 0) {
    diseaseDetections.forEach(d => {
      if (d.confidence > maxDetectionConfidence) {
        maxDetectionConfidence = d.confidence;
        highestConfidenceDisease = d;
      }
    });

    primaryDisease = highestConfidenceDisease?.diseaseName || highestConfidenceDisease?.displayName || "Disease Indicator";
    dominantCrop = highestConfidenceDisease?.crop || cropTypeHint || "Crop";
  } else if (unspecifiedLeafDetections.length > 0) {
    unspecifiedLeafDetections.forEach(d => {
      if (d.confidence > maxDetectionConfidence) {
        maxDetectionConfidence = d.confidence;
      }
    });
    dominantCrop = unspecifiedLeafDetections[0]?.crop || cropTypeHint || "Crop";
  }

  // 2. Routing AI Confidence based on strongest relevant disease detection
  const aiConfidenceCategory = getConfidenceCategory(maxDetectionConfidence);

  // 3. Spatial Coverage Calculation (Bounding Box Area)
  const imageArea = (origDimensions.width && origDimensions.height)
    ? (origDimensions.width * origDimensions.height)
    : 0;

  let sumWeightedArea = 0;
  if (imageArea > 0 && diseaseDetections.length > 0) {
    diseaseDetections.forEach(d => {
      const [x1, y1, x2, y2] = d.box;
      const boxWidth = Math.max(0, x2 - x1);
      const boxHeight = Math.max(0, y2 - y1);
      const boxArea = boxWidth * boxHeight;
      sumWeightedArea += d.confidence * boxArea;
    });
  }

  const rawVisualCoverage = imageArea > 0 ? (100 * sumWeightedArea) / imageArea : 0;
  const visualCoverage = Math.min(100, Math.max(0, rawVisualCoverage));

  // 4. AI Visual Disease Burden Score
  // AIVisualDiseaseBurden = 0.60 * maxConfidenceScore + 0.40 * visualCoverage
  let AIVisualDiseaseBurden = 0;
  if (diseaseDetections.length > 0) {
    const maxConfidenceScore = maxDetectionConfidence * 100;
    const rawBurden = 0.60 * maxConfidenceScore + 0.40 * visualCoverage;
    AIVisualDiseaseBurden = Math.min(100, Math.max(1, Math.round(rawBurden)));
  } else {
    AIVisualDiseaseBurden = 0;
  }

  const burdenCategory = getBurdenCategory(AIVisualDiseaseBurden);

  // 5. Overall Condition Label & Confidence Safeguard
  let conditionLabel = "NO DISEASE INDICATOR DETECTED";
  let conditionKey = "low"; // styling key: low | medium | high | critical

  if (diseaseDetections.length === 0 || AIVisualDiseaseBurden === 0) {
    conditionLabel = "NO DISEASE INDICATOR DETECTED";
    conditionKey = "low";
  } else if (AIVisualDiseaseBurden <= 25) {
    conditionLabel = "LOW CONCERN";
    conditionKey = "low";
  } else if (AIVisualDiseaseBurden <= 50) {
    conditionLabel = "REVIEW REQUIRED";
    conditionKey = "medium";
  } else if (AIVisualDiseaseBurden <= 75) {
    conditionLabel = "HIGH CONCERN";
    conditionKey = "high";
  } else {
    conditionLabel = "CRITICAL CONDITION";
    conditionKey = "critical";
  }

  // Confidence Safeguard:
  // If strongest disease detection has confidence < 0.50, do NOT display CRITICAL CONDITION or HIGH CONCERN
  if (diseaseDetections.length > 0 && maxDetectionConfidence < 0.50) {
    if (conditionLabel === "CRITICAL CONDITION" || conditionLabel === "HIGH CONCERN") {
      conditionLabel = "REVIEW REQUIRED";
      conditionKey = "medium";
    }
  }

  // 6. Dynamic Agronomic Assessment Language
  let description = "";
  if (diseaseDetections.length > 0) {
    if (maxDetectionConfidence < 0.50) {
      description = `Visual indicators consistent with ${dominantCrop} ${primaryDisease} were detected, but confidence is limited. Further agronomic inspection is recommended before making crop-management or resource-recovery decisions.`;
    } else if (maxDetectionConfidence < 0.75) {
      description = `Visual indicators consistent with ${dominantCrop} ${primaryDisease} were detected with moderate model confidence. Agronomic inspection is recommended before making crop-management or resource-recovery decisions.`;
    } else {
      description = `Strong visual indicators consistent with ${dominantCrop} ${primaryDisease} were detected. Agronomic assessment is recommended for appropriate crop-management or resource-recovery decisions.`;
    }
  } else if (unspecifiedLeafDetections.length > 0) {
    description = `Foliage detected for ${dominantCrop} (${unspecifiedLeafDetections.length} leaf regions). No specific disease symptoms identified by the model.`;
  } else {
    description = `Scan completed for ${dominantCrop}. No standard leaf disease patterns detected above confidence threshold.`;
  }

  // 7. Routing Recommendation & Safety Reasoning
  let recommendation = {
    feature: "AgroConnect",
    action: "Direct Market Sale & Routine Field Monitoring",
    reason: "No active disease indicators detected in current scan. Generic leaf status indicates foliage presence without verified disease markers; continue standard agronomic management.",
    confidence: aiConfidenceCategory
  };

  if (diseaseDetections.length > 0) {
    let safetyReasoning = "";
    if (maxDetectionConfidence >= 0.75) {
      safetyReasoning = `Strong visual indicators consistent with ${dominantCrop} ${primaryDisease} were detected. Agronomic and safety assessment is required before any secondary use. Diseased material must not be assumed safe for livestock feed; if safety thresholds fail, convert to compost/biochar via Carbon Cash.`;
    } else {
      safetyReasoning = `Visual indicators consistent with ${dominantCrop} ${primaryDisease} were detected. Agronomic and safety assessment is required before any secondary use. Diseased material must not be assumed safe for livestock feed; if safety thresholds fail, convert to compost/biochar via Carbon Cash.`;
    }

    if (conditionLabel === "CRITICAL CONDITION" || conditionLabel === "HIGH CONCERN" || conditionLabel === "REVIEW REQUIRED") {
      recommendation = {
        feature: "Resource Recovery / Waste Matcher",
        action: "Resource Recovery Assessment & Composting Evaluation",
        reason: safetyReasoning,
        confidence: aiConfidenceCategory
      };
    } else {
      recommendation = {
        feature: "Waste Market",
        action: "Secondary Processing Evaluation & Localized Segregation",
        reason: safetyReasoning,
        confidence: aiConfidenceCategory
      };
    }
  }

  const usableEstimatedScore = Math.max(0, 100 - AIVisualDiseaseBurden);

  return {
    cropName: dominantCrop,
    condition: conditionKey,
    conditionLabel,
    damagePercentage: AIVisualDiseaseBurden, // for backward compatibility in mockApi
    usablePercentage: usableEstimatedScore,
    diseaseBurdenScore: AIVisualDiseaseBurden,
    visualCoverage: Number(visualCoverage.toFixed(1)),
    maxDetectionConfidence: Number(maxDetectionConfidence.toFixed(4)),
    burdenCategory,
    diseaseDetectionCount: diseaseDetections.length,
    unspecifiedLeafCount: unspecifiedLeafDetections.length,
    totalDetectionsCount: detections.length,
    primaryDisease,
    description,
    finalRecommendation: recommendation,
    detections: detections.map(d => ({
      ...d,
      confidenceCategory: getConfidenceCategory(d.confidence)
    })),
    date: new Date().toISOString().split("T")[0]
  };
}

/**
 * Main entry point: runs end-to-end YOLO ONNX inference on an image
 */
export async function runYOLOScan(imageSource, cropTypeHint = "") {
  const session = await getYOLOSession();
  const { tensor, transform } = await preprocessImage(imageSource);

  const results = await session.run({ images: tensor });
  const outputTensor = results["output0"];

  if (!outputTensor) {
    throw new Error("Invalid output received from YOLO ONNX model.");
  }

  const detections = postprocessYOLO(outputTensor, transform, 0.25, 0.45);
  const assessment = computeViabilityAssessment(detections, cropTypeHint, {
    width: transform.origW,
    height: transform.origH
  });

  return assessment;
}
