import { useState, useEffect, useRef } from "react";
import { mockApi } from "@/api/mockApi";
import { runYOLOScan, getYOLOSession } from "@/services/yoloScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ScanLine,
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Sprout,
  HandCoins,
  ArrowRight,
  Eye,
  Layers,
  Info,
  Bug
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const damageColors = {
  low: { bg: "bg-emerald-100 text-emerald-700", border: "border-emerald-200", icon: CheckCircle },
  medium: { bg: "bg-amber-100 text-amber-700", border: "border-amber-200", icon: AlertTriangle },
  high: { bg: "bg-orange-100 text-orange-700", border: "border-orange-200", icon: AlertTriangle },
  critical: { bg: "bg-red-100 text-red-700", border: "border-red-200", icon: XCircle },
};

export default function ViabilityScanner() {
  const [cropType, setCropType] = useState("");
  const [landSize, setLandSize] = useState("");
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState("");
  const [scanError, setScanError] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showDebugDetections, setShowDebugDetections] = useState(false);

  const canvasRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  // Draw bounding boxes on canvas whenever result or showBoxes changes
  useEffect(() => {
    if (!result || !result.image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = result.image;

    img.onload = () => {
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      ctx.drawImage(img, 0, 0);

      if (!showBoxes || !result.detections || result.detections.length === 0) {
        return;
      }

      result.detections.forEach((det, idx) => {
        const [x1, y1, x2, y2] = det.box;
        const w = x2 - x1;
        const h = y2 - y1;

        const isDis = det.isDisease;
        const strokeColor = isDis ? "#ef4444" : "#10b981";
        const fillColor = isDis ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)";

        // Box
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(2, Math.round(canvas.width / 300));
        ctx.fillStyle = fillColor;
        ctx.fillRect(x1, y1, w, h);
        ctx.strokeRect(x1, y1, w, h);

        // Label
        const label = `${det.rawName} (${(det.confidence * 100).toFixed(1)}%)`;
        const fontSize = Math.max(12, Math.round(canvas.width / 45));
        ctx.font = `bold ${fontSize}px sans-serif`;
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = strokeColor;
        ctx.fillRect(x1, Math.max(0, y1 - fontSize - 6), textWidth + 10, fontSize + 6);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, x1 + 5, Math.max(fontSize, y1 - 4));
      });
    };
  }, [result, showBoxes]);

  async function loadHistory() {
    const scans = await mockApi.entities.ViabilityScan.list("-created_date", 20);
    setHistory(scans);
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result);
    };
    reader.readAsDataURL(file);
    setResult(null);
    setScanError(null);
  };

  // Helper for quick testing with the known PlantDoc sample image (Potato Late Blight)
  const loadPlantDocTestSample = async () => {
    try {
      setScanStage("Loading test image...");
      setCropType("Potato");
      const res = await fetch("/LateBlight04.jpg");
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setResult(null);
        setScanError(null);
        setScanStage("");
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Failed to load test sample:", err);
      setScanError("Could not load /LateBlight04.jpg sample image.");
      setScanStage("");
    }
  };

  // Helper for testing Grape Black Rot sample
  const loadGrapeTestSample = async () => {
    try {
      setScanStage("Loading test image...");
      setCropType("Grape");
      const res = await fetch("/03gb.jpg");
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setResult(null);
        setScanError(null);
        setScanStage("");
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Failed to load grape test sample:", err);
      setScanError("Could not load /03gb.jpg sample image.");
      setScanStage("");
    }
  };

  async function handleScan() {
    if (!image) return;
    setScanning(true);
    setScanError(null);

    try {
      setScanStage("Loading AI model...");
      await getYOLOSession();

      setScanStage("Running local YOLO11n inference...");
      const analysis = await runYOLOScan(image, cropType || "Crop");

      setScanStage("Evaluating agronomic assessment...");
      const user = await mockApi.auth.me();
      const finalDamage = analysis.damagePercentage;
      const finalAcres = Number(landSize) || 2;

      await mockApi.entities.ViabilityScan.create({
        cropName: analysis.cropName || cropType || "Crop",
        image: image,
        usablePercentage: analysis.usablePercentage,
        damagePercentage: finalDamage,
        condition: analysis.condition,
        description: analysis.description,
        action: analysis.finalRecommendation?.action || "No action provided",
        recommendedFeature: analysis.finalRecommendation?.feature || "None",
        reason: analysis.finalRecommendation?.reason || "",
        confidence: analysis.finalRecommendation?.confidence || "Medium",
        date: analysis.date || new Date().toISOString().split("T")[0],
        totalDetectionsCount: analysis.totalDetectionsCount || 0,
        diseaseDetectionCount: analysis.diseaseDetectionCount || 0,
        detections: analysis.detections || []
      });

      // Cross-integration logic: If disease burden >= 50, auto-log to Carbon Cash
      if (finalDamage >= 50) {
        const co2_saved = finalAcres * 850;
        const credits = co2_saved / 1000;
        const value = credits * 500;

        await mockApi.entities.CarbonActivity.create({
          activity_type: "composting",
          area_acres: finalAcres,
          description: `Auto-logged from Viability Scanner (${finalDamage}% disease burden in ${analysis.cropName})`,
          co2_saved_kg: co2_saved,
          credits_earned: credits,
          credit_value_inr: value,
          farmer_name: user.full_name,
          status: "verified"
        });
      }

      setResult({ ...analysis, image });
      if (!cropType && analysis.cropName) {
        setCropType(analysis.cropName);
      }
    } catch (error) {
      console.error("YOLO Scan Error:", error);
      setScanError(error.message || "AI inference failed. Please check model files and try again.");
    } finally {
      setScanning(false);
      setScanStage("");
      loadHistory();
    }
  }

  const dmg = result ? damageColors[result.condition] || damageColors.medium : null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">🌾 Viability Scanner</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Local YOLO11n AI inference for crop disease detection and agronomic routing
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            placeholder="Crop Type (e.g. Potato, Tomato, Corn)"
            value={cropType}
            onChange={(e) => setCropType(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Land Size (Acres)"
            value={landSize}
            onChange={(e) => setLandSize(e.target.value)}
          />
        </div>

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-all overflow-hidden relative">
          {image ? (
            <img
              src={image || "/placeholder.png"}
              alt="crop"
              style={{ width: "100%", height: "220px", objectFit: "contain" }}
            />
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">Click to upload crop image</p>
              <p className="text-xs text-muted-foreground mt-1">Supports JPG, PNG, WebP</p>
            </>
          )}
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadPlantDocTestSample}
              disabled={scanning}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              🧪 Potato Late Blight (LateBlight04)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadGrapeTestSample}
              disabled={scanning}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              🍇 Grape Black Rot (03gb)
            </Button>
          </div>

          {image && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setImage(null);
                setResult(null);
                setScanError(null);
              }}
              disabled={scanning}
              className="text-xs text-muted-foreground"
            >
              Clear Image
            </Button>
          )}
        </div>

        {scanError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">AI Scan Error</p>
              <p className="text-xs mt-0.5">{scanError}</p>
              <p className="text-xs mt-1 text-muted-foreground">Please try again or select a valid image.</p>
            </div>
          </div>
        )}

        <Button
          onClick={handleScan}
          disabled={!image || scanning}
          className="w-full gap-2 py-6 text-lg font-semibold"
        >
          {scanning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {scanStage || "Analyzing with YOLO11n..."}
            </>
          ) : (
            <>
              <ScanLine className="h-5 w-5" />
              Run YOLO Viability Scan
            </>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`bg-card rounded-2xl border ${dmg?.border} p-6 space-y-6 shadow-sm`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-bold text-2xl mb-1">{result.cropName}</h2>
                <p className="text-sm text-muted-foreground">Scanned on {result.date}</p>
              </div>
              <Badge className={`${dmg?.bg} px-3 py-1 text-sm font-semibold uppercase tracking-wider`}>
                {result.conditionLabel || `${result.condition} Condition`}
              </Badge>
            </div>

            {/* Visual Bounding Box Overlay Canvas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  <Layers className="h-3.5 w-3.5" /> AI Visual Detection Map
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setShowBoxes(!showBoxes)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {showBoxes ? "Hide Bounding Boxes" : "Show Bounding Boxes"}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden border border-border bg-black/5 flex justify-center items-center max-h-[360px]">
                <canvas
                  ref={canvasRef}
                  className="max-w-full max-h-[360px] object-contain rounded-lg shadow-sm"
                />
              </div>
            </div>

            {/* Primary Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary/10 rounded-xl p-5 text-center flex flex-col justify-center border border-primary/20">
                <p className="text-4xl font-bold text-primary mb-1">{result.usablePercentage}/100</p>
                <p className="text-sm font-medium text-foreground">Estimated Resource Usability Index</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  AI-derived routing score based on the detected visual condition; not a laboratory safety or quality certification.
                </p>
              </div>
              <div className="bg-destructive/10 rounded-xl p-5 text-center flex flex-col justify-center border border-destructive/20">
                <p className="text-4xl font-bold text-destructive mb-1">{result.diseaseBurdenScore}/100</p>
                <p className="text-sm font-medium text-foreground">AI Visual Disease Burden</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  AI-derived image-level score based on confidence-weighted detected visual disease indicators and their spatial distribution; not a percentage of physical crop damage or field loss.
                </p>
              </div>
            </div>

            {/* Analysis Summary */}
            <div className="bg-muted/30 p-4 rounded-xl space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                <Sprout className="h-4 w-4 text-primary" /> AI Agronomic Assessment
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.description}</p>
              <div className="pt-2 flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border/50">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  Visual coverage: {result.visualCoverage}% • Burden category: {result.burdenCategory || "Evaluated"} • Strongest confidence: {result.finalRecommendation?.confidence || "Moderate"}.
                </span>
              </div>
            </div>

            {/* Final Recommendation Card */}
            <div className="bg-primary/5 rounded-xl p-5 border border-primary/20">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-primary" /> 🔥 RECOMMENDED AGROCYCLE ROUTING
              </h3>
              <div className="space-y-3">
                {result.finalRecommendation && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Target Feature</p>
                        <p className="text-lg font-bold text-primary flex items-center gap-1">
                          {result.finalRecommendation.feature} <ArrowRight className="h-4 w-4" />
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">AI Confidence</p>
                        <p className="text-sm font-semibold">{result.finalRecommendation.confidence}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Suggested Action</p>
                      <p className="font-bold text-foreground">{result.finalRecommendation.action}</p>
                    </div>
                    <div className="bg-background/80 p-3 rounded-lg border border-border mt-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Agronomic Reasoning & Safety Note</p>
                      <p className="text-sm leading-relaxed">{result.finalRecommendation.reason}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Inspection & Debug Breakdown */}
            <div className="border border-border/60 rounded-xl p-4 bg-muted/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bug className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">Inspection & Detections Breakdown</span>
                  <Badge variant="outline" className="text-[11px]">
                    {result.detections?.length || 0} Detections
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setShowDebugDetections(!showDebugDetections)}
                >
                  {showDebugDetections ? "Hide Details" : "View Details"}
                </Button>
              </div>

              {showDebugDetections && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  {result.detections && result.detections.length > 0 ? (
                    <div className="grid gap-2">
                      {result.detections.map((det, idx) => (
                        <div
                          key={idx}
                          className="bg-card border border-border p-2.5 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{det.displayName}</span>
                              <Badge
                                variant={det.isDisease ? "destructive" : "secondary"}
                                className="text-[10px] py-0 px-1.5"
                              >
                                {det.isDisease ? `Disease (${det.confidenceCategory || "Score"})` : "Unspecified Leaf"}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              Raw Class: {det.rawName} | Box: [{det.box.join(", ")}]
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-sm text-primary">
                              {(det.confidence * 100).toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              {det.confidenceCategory}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No candidate detections passed the confidence threshold (0.25).
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {history.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-bold text-xl">📋 Scan History</h2>
          <div className="grid gap-3">
            {history.map((scan, i) => {
              const d = damageColors[scan.condition] || damageColors.medium;
              const damageIcon = <d.icon className="h-4 w-4" />;
              return (
                <motion.div
                  key={scan.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border rounded-xl p-4 flex gap-5 hover:border-primary/50 transition-colors cursor-default"
                >
                  {scan.image && (
                    <div className="relative">
                      <img
                        src={scan.image}
                        alt={scan.cropName}
                        className="w-24 h-24 rounded-lg object-cover flex-shrink-0 shadow-sm"
                      />
                      <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-0.5 border border-border shadow-sm">
                        {damageIcon}
                      </div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-lg">{scan.cropName}</span>
                        <span className="text-xs text-muted-foreground font-medium">{scan.date}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge className={`${d.bg} text-[10px] uppercase font-bold tracking-wider`}>
                          {scan.condition}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">
                          Usability: {scan.usablePercentage}/100
                        </Badge>
                        {scan.recommendedFeature && scan.recommendedFeature !== "None" && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] text-primary bg-primary/10 border-primary/20"
                          >
                            {scan.recommendedFeature}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                        {scan.description}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-foreground items-center flex gap-1.5">
                      <HandCoins className="h-3.5 w-3.5 text-primary" /> {scan.action}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}