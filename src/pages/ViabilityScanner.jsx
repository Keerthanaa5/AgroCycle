import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { mockApi } from "@/api/mockApi";
import { analyzeSingleSample, getYOLOSession } from "@/services/yoloScanner";
import {
  aggregateFieldAssessment,
  MIN_REQUIRED_SAMPLES,
  FIELD_ZONES,
  REQUIRED_ZONES,
  ZONE_LABELS,
  getSamplingRepresentation
} from "@/services/fieldAssessmentEngine";
import { PATHWAY_NAMES, PATHWAY_ROUTES } from "@/services/decisionEngine";
import { getSavedLocation, formatCoordinate } from "@/services/locationService";
import { setAssessmentHandoff, createHandoffFromAssessment } from "@/services/assessmentHandoffService";
import { useLanguage, getLocalizedDecisionText } from "@/i18n";
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
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ExternalLink,
  Sparkles,
  Leaf,
  Plus,
  Trash2,
  Camera,
  MapPin,
  Check,
  RefreshCw,
  Play,
  ShoppingBag,
  Store,
  Tag,
  Calendar,
  Truck,
  DollarSign,
  Compass,
  Crosshair,
  Map as MapIcon,
  TrendingUp,
  Users
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import VoiceButton from "@/components/VoiceButton";

const damageColors = {
  low: { bg: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200", border: "border-emerald-200 dark:border-emerald-800", icon: CheckCircle },
  medium: { bg: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200", border: "border-amber-200 dark:border-amber-800", icon: AlertTriangle },
  high: { bg: "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-200", border: "border-orange-200 dark:border-orange-800", icon: AlertTriangle },
  critical: { bg: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200", border: "border-rose-200 dark:border-rose-800", icon: XCircle },
};

const confidenceBadges = {
  High: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200",
  Moderate: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200",
  Low: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-800 dark:text-stone-300"
};

const statusBadges = {
  recommended: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200",
  conditional: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200",
  "not eligible": "bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-800 dark:text-stone-400"
};

const SELLING_PREFERENCES_OPTIONS = [
  { id: "bulk_wholesale", label: "Bulk / Wholesale Buyer" },
  { id: "local_nearby", label: "Local / Nearby Buyer" },
  { id: "entire_lot", label: "Entire Lot in One Order" },
  { id: "partial_lots", label: "Partial / Split Lots Allowed" }
];

const INITIAL_ZONES_CONFIG = [
  { zone: "north", label: "North", positionName: "North Section", icon: "🧭", subtext: "Northern field perimeter" },
  { zone: "east", label: "East", positionName: "East Section", icon: "🧭", subtext: "Eastern field boundary" },
  { zone: "south", label: "South", positionName: "South Section", icon: "🧭", subtext: "Southern field perimeter" },
  { zone: "west", label: "West", positionName: "West Section", icon: "🧭", subtext: "Western field boundary" },
  { zone: "centre", label: "Centre", positionName: "Centre Section", icon: "🎯", subtext: "Core / Central field area" }
];

function createEmptyZoneSamples() {
  return INITIAL_ZONES_CONFIG.map((cfg) => ({
    id: `sample-${cfg.zone}`,
    zone: cfg.zone,
    label: cfg.label,
    positionName: cfg.positionName,
    image: null,
    status: "not_captured", // "not_captured" | "analyzing" | "analyzed" | "failed"
    error: null,
    detections: [],
    confidence: 0,
    highestConfidence: 0,
    visualCoverage: 0,
    visualDiseaseBurden: 0,
    burdenScore: 0,
    primaryDisease: null,
    hasDisease: false,
    conditionKey: "low",
    totalDetectionsCount: 0,
    analyzedAt: null
  }));
}

/**
 * Interactive Visual Field Layout Diagram
 * Renders the spatial 5-point field map:
 *                  NORTH (📸)
 *                     |
 *  WEST (📸) ----- CENTRE (📸) ----- EAST (📸)
 *                     |
 *                  SOUTH (📸)
 */
function SpatialFieldLayout({ zoneSamples, activeZone, onSelectZone, onUploadTrigger }) {
  const getZoneSample = (zoneId) => zoneSamples.find((s) => s.zone === zoneId) || {};

  return (
    <div className="bg-muted/30 border border-border/80 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            5-Point Spatial Field Sampling Map
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Capture 1 representative crop/leaf sample from each field section
        </span>
      </div>

      {/* Visual Compass / Cross Grid Layout */}
      <div className="relative max-w-md mx-auto aspect-square sm:aspect-[4/3] bg-card/70 rounded-2xl border border-border/70 p-4 flex items-center justify-center overflow-hidden">
        {/* Coordinate cross lines */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-[2px] bg-dashed border-t-2 border-dashed border-primary/20" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-full w-[2px] bg-dashed border-l-2 border-dashed border-primary/20" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
          <div className="w-3/4 h-3/4 rounded-full border-2 border-primary" />
        </div>

        {/* 5 Spatial Nodes */}
        <div className="relative w-full h-full">
          {/* NORTH (Top Center) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2">
            <SpatialNodeBadge
              zoneConfig={INITIAL_ZONES_CONFIG[0]}
              sample={getZoneSample("north")}
              isSelected={activeZone === "north"}
              onSelect={() => onSelectZone("north")}
              onUploadClick={() => onUploadTrigger("north")}
            />
          </div>

          {/* WEST (Middle Left) */}
          <div className="absolute top-1/2 left-2 -translate-y-1/2">
            <SpatialNodeBadge
              zoneConfig={INITIAL_ZONES_CONFIG[3]}
              sample={getZoneSample("west")}
              isSelected={activeZone === "west"}
              onSelect={() => onSelectZone("west")}
              onUploadClick={() => onUploadTrigger("west")}
            />
          </div>

          {/* CENTRE (Middle Center) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <SpatialNodeBadge
              zoneConfig={INITIAL_ZONES_CONFIG[4]}
              sample={getZoneSample("centre")}
              isSelected={activeZone === "centre"}
              onSelect={() => onSelectZone("centre")}
              onUploadClick={() => onUploadTrigger("centre")}
              isCentre={true}
            />
          </div>

          {/* EAST (Middle Right) */}
          <div className="absolute top-1/2 right-2 -translate-y-1/2">
            <SpatialNodeBadge
              zoneConfig={INITIAL_ZONES_CONFIG[1]}
              sample={getZoneSample("east")}
              isSelected={activeZone === "east"}
              onSelect={() => onSelectZone("east")}
              onUploadClick={() => onUploadTrigger("east")}
            />
          </div>

          {/* SOUTH (Bottom Center) */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <SpatialNodeBadge
              zoneConfig={INITIAL_ZONES_CONFIG[2]}
              sample={getZoneSample("south")}
              isSelected={activeZone === "south"}
              onSelect={() => onSelectZone("south")}
              onUploadClick={() => onUploadTrigger("south")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SpatialNodeBadge({ zoneConfig, sample, isSelected, onSelect, onUploadClick, isCentre = false }) {
  const isAnalyzed = sample?.status === "analyzed";
  const isAnalyzing = sample?.status === "analyzing";
  const isFailed = sample?.status === "failed";
  const isNotCaptured = !isAnalyzed && !isAnalyzing && !isFailed;

  return (
    <button
      type="button"
      onClick={isNotCaptured ? onUploadClick : onSelect}
      className={`group flex flex-col items-center p-2 rounded-2xl border transition-all text-xs shadow-xs ${
        isSelected
          ? "ring-2 ring-primary border-primary bg-primary/10 scale-105"
          : isAnalyzed
          ? sample?.hasDisease
            ? "bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900"
            : "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900"
          : isAnalyzing
          ? "bg-emerald-50/80 border-emerald-400 animate-pulse ring-1 ring-emerald-400"
          : isFailed
          ? "bg-rose-50 border-rose-300"
          : "bg-card/90 border-border hover:border-primary/50 hover:bg-muted/50"
      } ${isCentre ? "w-28 sm:w-32" : "w-24 sm:w-28"}`}
    >
      <div className="flex items-center gap-1 font-bold text-[11px] text-foreground">
        <span>{zoneConfig.label}</span>
      </div>

      {/* Center preview or status icon */}
      <div className="w-10 h-10 rounded-xl mt-1 overflow-hidden bg-muted/60 border border-border/70 flex items-center justify-center relative">
        {sample?.image ? (
          <img
            src={sample.image}
            alt={zoneConfig.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <Camera className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        )}

        {/* Small Status indicator overlay */}
        {isAnalyzed && (
          <div className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full flex items-center justify-center ${sample?.hasDisease ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"}`}>
            <Check className="h-2 w-2" />
          </div>
        )}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-[0.5px] flex items-center justify-center">
            <Loader2 className="h-4 w-4 text-emerald-300 animate-spin" />
          </div>
        )}
        {isFailed && (
          <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-rose-600 text-white flex items-center justify-center">
            <XCircle className="h-2.5 w-2.5" />
          </div>
        )}
      </div>

      {/* State Text */}
      <span className="text-[10px] font-medium mt-1 truncate max-w-[90px] text-muted-foreground">
        {isAnalyzed
          ? sample?.hasDisease
            ? "Disease Found"
            : "Clean Foliage"
          : isAnalyzing
          ? "Analyzing..."
          : isFailed
          ? "Failed"
          : "Not captured"}
      </span>
    </button>
  );
}

/**
 * Dedicated Spatial Zone Card
 * Represents one of the 5 fixed field positions: North, East, South, West, Centre.
 * Runs instant YOLO inference upon capture with live laser scanning animation.
 */
function SpatialZoneCard({
  zoneConfig,
  sample,
  onUploadImage,
  onRetry,
  onRemove,
  showBoxes,
  getDiseaseName,
  t,
  language
}) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const drawCardCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sample?.image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const w = img.naturalWidth || img.width || 400;
      const h = img.naturalHeight || img.height || 300;
      canvas.width = w;
      canvas.height = h;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      if (!showBoxes || sample.status !== "analyzed" || !sample.detections || sample.detections.length === 0) {
        return;
      }

      sample.detections.forEach((det) => {
        if (!det.box || det.box.length < 4) return;
        const [x1, y1, x2, y2] = det.box;
        const boxW = Math.max(0, x2 - x1);
        const boxH = Math.max(0, y2 - y1);

        const isDis = det.isDisease;
        const strokeColor = isDis ? "#e11d48" : "#16a34a";
        const fillColor = isDis ? "rgba(225, 29, 72, 0.18)" : "rgba(22, 163, 74, 0.18)";

        ctx.fillStyle = fillColor;
        ctx.fillRect(x1, y1, boxW, boxH);

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(3, Math.round(w / 220));
        ctx.strokeRect(x1, y1, boxW, boxH);

        const localizedLabel = getDiseaseName(det.rawName) || det.displayName || "Leaf";
        const confText = `${(det.confidence * 100).toFixed(1)}%`;
        const labelText = `${localizedLabel} (${confText})`;

        const fontSize = Math.max(12, Math.round(w / 32));
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
        const textMetrics = ctx.measureText(labelText);
        const badgeWidth = textMetrics.width + 12;
        const badgeHeight = fontSize + 8;
        const badgeY = Math.max(0, y1 - badgeHeight);

        ctx.fillStyle = strokeColor;
        ctx.fillRect(x1, badgeY, badgeWidth, badgeHeight);

        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, x1 + 6, badgeY + badgeHeight / 2);
      });
    };

    img.src = sample.image;
    if (img.complete && img.naturalWidth > 0) {
      img.onload();
    }
  }, [sample, showBoxes, getDiseaseName]);

  useEffect(() => {
    drawCardCanvas();
  }, [drawCardCanvas, sample?.status, sample?.detections, language, showBoxes]);

  const isAnalyzed = sample?.status === "analyzed";
  const isAnalyzing = sample?.status === "analyzing";
  const isFailed = sample?.status === "failed";
  const isNotCaptured = !isAnalyzed && !isAnalyzing && !isFailed;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(zoneConfig.zone, file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-2xl border transition-all overflow-hidden flex flex-col justify-between shadow-xs ${
        isAnalyzing
          ? "border-emerald-500/70 ring-2 ring-emerald-500/25 shadow-lg"
          : isFailed
          ? "border-rose-300 dark:border-rose-900 bg-rose-50/20"
          : isAnalyzed
          ? sample?.hasDisease
            ? "border-rose-200 dark:border-rose-900/60"
            : "border-emerald-200 dark:border-emerald-900/60"
          : "border-border/80 hover:border-primary/40"
      }`}
    >
      {/* Zone Header */}
      <div className="p-3 bg-muted/30 border-b border-border/60 flex items-center justify-between gap-1.5 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
            <span>{zoneConfig.icon}</span>
            <span>{zoneConfig.label}</span>
          </span>
          <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
            ({zoneConfig.subtext})
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Status Badge */}
          {isAnalyzed && (
            <Badge
              variant="outline"
              className={`text-[10px] px-2 py-0.5 font-bold rounded-full ${
                sample?.hasDisease
                  ? "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200"
              }`}
            >
              <Check className="h-3 w-3 mr-0.5 inline" /> {sample?.hasDisease ? "Disease Found" : "Clean"}
            </Badge>
          )}
          {isAnalyzing && (
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 px-2 py-0.5 font-bold rounded-full animate-pulse shadow-xs">
              <Loader2 className="h-3 w-3 mr-0.5 inline animate-spin text-emerald-600 dark:text-emerald-400" /> Analyzing...
            </Badge>
          )}
          {isFailed && (
            <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 px-2 py-0.5 font-bold rounded-full">
              <XCircle className="h-3 w-3 mr-0.5 inline" /> Failed
            </Badge>
          )}
          {isNotCaptured && (
            <Badge variant="outline" className="text-[10px] bg-stone-100 text-stone-600 border-stone-300 dark:bg-stone-800 dark:text-stone-300 px-2 py-0.5 font-medium rounded-full">
              Not captured
            </Badge>
          )}

          {sample?.image && (
            <button
              type="button"
              onClick={() => onRemove(zoneConfig.zone)}
              className="text-muted-foreground hover:text-rose-600 transition-colors p-1 rounded-md"
              title="Clear zone sample"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Image & Canvas Display Area with Live Scanning Laser Effect */}
      <div className="relative w-full aspect-[4/3] bg-stone-900/5 flex items-center justify-center overflow-hidden">
        {sample?.image ? (
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center p-4 text-center hover:bg-primary/5 transition-colors group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-105 transition-transform border border-primary/20">
              <Camera className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-foreground">
              Capture {zoneConfig.label} Sample
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Click to photograph or upload {zoneConfig.label} foliage
            </p>
          </button>
        )}

        {/* Hidden File Input specifically for this zone */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* HIGH-TECH GLOWING SCANNING LASER BEAM (Live during active YOLO analysis) */}
        {isAnalyzing && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
            <div className="absolute inset-0 scan-grid-overlay opacity-35" />
            <div className="absolute left-0 right-0 h-16 -mt-8 animate-scan-beam pointer-events-none">
              <div className="w-full h-full bg-gradient-to-b from-transparent via-emerald-400/30 to-transparent backdrop-blur-[0.5px]" />
              <div className="absolute top-1/2 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-emerald-300 via-cyan-300 to-transparent shadow-[0_0_22px_5px_rgba(52,211,153,0.95),0_0_10px_2px_rgba(6,182,212,0.95)]" />
            </div>
            <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
          </div>
        )}

        {/* Failed Overlay */}
        {isFailed && (
          <div className="absolute inset-0 bg-rose-950/60 backdrop-blur-[0.5px] flex flex-col items-center justify-center text-white text-xs p-3 text-center">
            <AlertTriangle className="h-6 w-6 text-rose-400 mb-1" />
            <p className="font-bold">Analysis Failed</p>
            <p className="text-[10px] text-rose-200 mt-0.5 line-clamp-2">{sample?.error || "Inference error"}</p>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onRetry(zoneConfig.zone)}
                className="h-6 text-[10px] gap-1 rounded-lg"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-6 text-[10px] gap-1 rounded-lg bg-card text-foreground"
              >
                Replace
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Card Footer: Live Diagnostic Metrics & Zone Actions */}
      <div className="p-3 bg-card border-t border-border/60 text-xs space-y-1.5">
        {isAnalyzed ? (
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="font-bold text-foreground text-xs truncate">
                {sample?.primaryDisease ? getDiseaseName(sample.primaryDisease) : "No disease-specific indicator detected"}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40 mt-1">
              <span>Confidence: <strong className="text-foreground">{(sample.confidence * 100).toFixed(1)}%</strong></span>
              <span>Visual Coverage: <strong className="text-foreground">{sample.visualCoverage}%</strong></span>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-6 text-[10px] text-primary hover:text-primary/80 p-0"
              >
                Replace image
              </Button>
              <span className="text-[9px] text-muted-foreground font-mono">
                Position: {zoneConfig.label}
              </span>
            </div>
          </div>
        ) : isAnalyzing ? (
          <div className="flex items-center gap-2 text-muted-foreground py-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 animate-pulse">Running live YOLO for {zoneConfig.label}...</span>
          </div>
        ) : isFailed ? (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-rose-600 font-semibold">Inference failed</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRetry(zoneConfig.zone)}
              className="h-6 text-[10px] text-rose-600 hover:text-rose-700 p-0"
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between text-muted-foreground py-0.5">
            <span className="text-[11px]">Position ready</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-6 text-[10px] rounded-lg text-primary border-primary/30"
            >
              + Upload
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ViabilityScanner() {
  const { language, t, getDiseaseName, getCropName } = useLanguage();
  const navigate = useNavigate();

  // 1. Crop & Field Information (Cultivated acreage is field context only)
  const [cropType, setCropType] = useState("");
  const [landSize, setLandSize] = useState("");

  // 2. Condition & Quality Context
  const [conditionQuality, setConditionQuality] = useState("not_sure");

  // 3. Field & Operational Context
  const [materialType, setMaterialType] = useState("standing_crop");
  const [problemDistribution, setProblemDistribution] = useState("unknown");
  const [burningRisk, setBurningRisk] = useState("unknown");
  const [insuranceInterest, setInsuranceInterest] = useState("unknown");
  const [feedRecoveryInterest, setFeedRecoveryInterest] = useState("unknown");
  const [communityExchangeInterest, setCommunityExchangeInterest] = useState("unknown");
  const [industrialProcessingInterest, setIndustrialProcessingInterest] = useState("unknown");
  const [damageLossDate, setDamageLossDate] = useState("");
  const [reportedDamageExtent, setReportedDamageExtent] = useState("not_sure");
  const [showContextOptions, setShowContextOptions] = useState(false);

  // 4. Fixed 5 Spatial Zone Samples (North, East, South, West, Centre)
  const [zoneSamples, setZoneSamples] = useState(() => createEmptyZoneSamples());
  const [activeZone, setActiveZone] = useState("north");

  // 5. Commercial & Marketplace Details (Optional — For downstream buyer matching)
  const [showCommercialOptions, setShowCommercialOptions] = useState(false);
  const [commercialQuantity, setCommercialQuantity] = useState("");
  const [commercialUnit, setCommercialUnit] = useState("kg");
  const [availableFromDate, setAvailableFromDate] = useState("");
  const [commercialState, setCommercialState] = useState("");
  const [commercialDistrict, setCommercialDistrict] = useState("");
  const [commercialVillage, setCommercialVillage] = useState("");
  const [expectedPrice, setExpectedPrice] = useState("");
  const [openToOffers, setOpenToOffers] = useState(true);
  const [sellingPreferences, setSellingPreferences] = useState(["bulk_wholesale"]);

  // Scanning & Results State
  const [isScanning, setIsScanning] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [result, setResult] = useState(null);
  const [activeInspectorZone, setActiveInspectorZone] = useState("north");
  const [history, setHistory] = useState([]);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showPathwayBreakdown, setShowPathwayBreakdown] = useState(false);

  const canvasRef = useRef(null);
  const bulkFileInputRef = useRef(null);
  const resultsRef = useRef(null);

  const handleLaunchClaimRocket = () => {
    if (!result) return;
    const handoff = createHandoffFromAssessment(result, "claim-rocket");
    setAssessmentHandoff(handoff);
    navigate("/claim-rocket");
  };

  // Automated Handoff to downstream feature (e.g. Claim Rocket, Urban Waste Matcher, Market Intelligence, AgroConnect)
  const handleLaunchPathway = (feature, defaultRoute) => {
    if (!result) return;
    if (feature === PATHWAY_NAMES.CLAIM_ROCKET || feature === "claim-rocket" || feature === "Claim Rocket") {
      handleLaunchClaimRocket();
      return;
    }
    if (feature === PATHWAY_NAMES.URBAN_WASTE_MATCHER) {
      const handoff = createHandoffFromAssessment(result, "urban-waste-matcher");
      setAssessmentHandoff(handoff);
      navigate("/waste-market");
      return;
    }
    if (feature === "market-intelligence" || feature === "Market Intelligence") {
      const handoff = createHandoffFromAssessment(result, "market-intelligence");
      setAssessmentHandoff(handoff);
      navigate("/market-intelligence");
      return;
    }
    if (feature === PATHWAY_NAMES.AGRO_CONNECT || feature === "agro-connect" || feature === "AgroConnect" || feature === "AgroConnect Community") {
      const handoff = createHandoffFromAssessment(result, "agro-connect");
      setAssessmentHandoff(handoff);
      navigate("/agro-connect");
      return;
    }
    navigate(defaultRoute || PATHWAY_ROUTES[feature] || "/waste-market");
  };

  const handleLaunchMarketIntelligence = () => {
    if (!result) return;
    const handoff = createHandoffFromAssessment(result, "market-intelligence");
    setAssessmentHandoff(handoff);
    navigate("/market-intelligence");
  };

  const handleLaunchAgroConnect = () => {
    if (!result) return;
    const handoff = createHandoffFromAssessment(result, "agro-connect");
    setAssessmentHandoff(handoff);
    navigate("/agro-connect");
  };

  // Toggle selling preferences multi-select
  const toggleSellingPreference = (prefId) => {
    setSellingPreferences((prev) =>
      prev.includes(prefId)
        ? prev.filter((p) => p !== prefId)
        : [...prev, prefId]
    );
  };

  const activeInspectorSample = result?.samples?.find((s) => s.zone === activeInspectorZone) || result?.samples?.[0] || null;

  // Canvas drawing for active representative sample in final report
  const drawInspectorCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeInspectorSample || !activeInspectorSample.image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    const render = () => {
      const w = img.naturalWidth || img.width || 640;
      const h = img.naturalHeight || img.height || 480;
      canvas.width = w;
      canvas.height = h;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      if (!showBoxes || !activeInspectorSample.detections || activeInspectorSample.detections.length === 0) {
        return;
      }

      activeInspectorSample.detections.forEach((det) => {
        if (!det.box || det.box.length < 4) return;
        const [x1, y1, x2, y2] = det.box;
        const boxW = Math.max(0, x2 - x1);
        const boxH = Math.max(0, y2 - y1);

        const isDis = det.isDisease;
        const strokeColor = isDis ? "#e11d48" : "#16a34a";
        const fillColor = isDis ? "rgba(225, 29, 72, 0.16)" : "rgba(22, 163, 74, 0.16)";

        ctx.fillStyle = fillColor;
        ctx.fillRect(x1, y1, boxW, boxH);

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(3, Math.round(w / 250));
        ctx.strokeRect(x1, y1, boxW, boxH);

        const localizedLabel = getDiseaseName(det.rawName) || det.displayName || "Leaf";
        const confText = `${(det.confidence * 100).toFixed(1)}%`;
        const labelText = `${localizedLabel} (${confText})`;

        const fontSize = Math.max(13, Math.round(w / 38));
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
        const textMetrics = ctx.measureText(labelText);
        const badgeWidth = textMetrics.width + 14;
        const badgeHeight = fontSize + 8;
        const badgeY = Math.max(0, y1 - badgeHeight);

        ctx.fillStyle = strokeColor;
        ctx.fillRect(x1, badgeY, badgeWidth, badgeHeight);

        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, x1 + 7, badgeY + badgeHeight / 2);
      });
    };

    img.onload = render;
    img.src = activeInspectorSample.image;
    if (img.complete && img.naturalWidth > 0) {
      render();
    }
  }, [activeInspectorSample, showBoxes, getDiseaseName]);

  const setCanvasElement = useCallback((node) => {
    canvasRef.current = node;
    if (node) {
      drawInspectorCanvas();
    }
  }, [drawInspectorCanvas]);

  useEffect(() => {
    drawInspectorCanvas();
  }, [drawInspectorCanvas, activeInspectorZone, language, showBoxes]);

  async function loadHistory() {
    try {
      const scans = await mockApi.entities.ViabilityScan.list("-created_date", 20);
      setHistory(scans);
    } catch (e) {
      console.warn("Could not load scan history:", e);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  /**
   * Run live YOLO inference immediately for a single spatial zone
   * Reuses the ONNX session singleton via getYOLOSession()
   */
  const analyzeZoneImage = async (zoneId, imageBase64) => {
    setZoneSamples((prev) =>
      prev.map((s) => (s.zone === zoneId ? { ...s, image: imageBase64, status: "analyzing", error: null } : s))
    );
    setScanError(null);
    setResult(null);

    try {
      await getYOLOSession();
      const analysis = await analyzeSingleSample(imageBase64, `sample-${zoneId}`, cropType || "Crop");

      if (!cropType && analysis.crop && analysis.crop !== "Crop") {
        setCropType(analysis.crop);
      }

      const analyzedObj = {
        id: `sample-${zoneId}`,
        zone: zoneId,
        label: ZONE_LABELS[zoneId],
        positionName: `${ZONE_LABELS[zoneId]} Section`,
        image: imageBase64,
        status: "analyzed",
        error: null,
        detections: analysis.detections || [],
        confidence: analysis.confidence || 0,
        highestConfidence: analysis.confidence || 0,
        visualCoverage: analysis.visualCoverage || 0,
        visualDiseaseBurden: analysis.burdenScore || 0,
        burdenScore: analysis.burdenScore || 0,
        primaryDisease: analysis.primaryDisease || null,
        hasDisease: analysis.hasDisease || false,
        conditionKey: analysis.conditionKey || "low",
        totalDetectionsCount: analysis.totalDetectionsCount || 0,
        crop: analysis.crop || cropType || "Crop",
        analyzedAt: Date.now()
      };

      setZoneSamples((prev) =>
        prev.map((s) => (s.zone === zoneId ? analyzedObj : s))
      );
    } catch (err) {
      console.error(`Inference error for zone ${zoneId}:`, err);
      setZoneSamples((prev) =>
        prev.map((s) => (s.zone === zoneId ? { ...s, image: imageBase64, status: "failed", error: err.message || "YOLO AI inference failed" } : s))
      );
    }
  };

  const handleZoneUpload = (zoneId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      analyzeZoneImage(zoneId, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRetryZone = (zoneId) => {
    const existing = zoneSamples.find((s) => s.zone === zoneId);
    if (existing?.image) {
      analyzeZoneImage(zoneId, existing.image);
    }
  };

  const handleRemoveZone = (zoneId) => {
    setZoneSamples((prev) =>
      prev.map((s) =>
        s.zone === zoneId
          ? {
              ...s,
              image: null,
              status: "not_captured",
              error: null,
              detections: [],
              confidence: 0,
              highestConfidence: 0,
              visualCoverage: 0,
              visualDiseaseBurden: 0,
              burdenScore: 0,
              primaryDisease: null,
              hasDisease: false,
              conditionKey: "low",
              totalDetectionsCount: 0,
              analyzedAt: null
            }
          : s
      )
    );
    setResult(null);
    setScanError(null);
  };

  // Bulk 5-sample upload handler
  const handleBulkUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (let i = 0; i < Math.min(files.length, REQUIRED_ZONES.length); i++) {
      const zoneId = REQUIRED_ZONES[i];
      const file = files[i];
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      await analyzeZoneImage(zoneId, base64);
    }

    if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
  };

  // Helper to load 5-point test sample sets
  const loadTestSampleSet = async (type) => {
    try {
      setScanError(null);
      setResult(null);

      let targetCrop = "Potato";
      let imagePaths = [];

      if (type === "potato") {
        targetCrop = "Potato";
        imagePaths = [
          "/LateBlight04.jpg",
          "/LateBlight04.jpg",
          "/LateBlight04.jpg",
          "/LateBlight04.jpg",
          "/LateBlight04.jpg"
        ];
      } else if (type === "grape") {
        targetCrop = "Grape";
        imagePaths = [
          "/03gb.jpg",
          "/03gb.jpg",
          "/03gb.jpg",
          "/03gb.jpg",
          "/03gb.jpg"
        ];
      } else if (type === "mixed") {
        targetCrop = "Potato";
        imagePaths = [
          "/LateBlight04.jpg", // North (Late Blight)
          "/03gb.jpg",          // East (Grape leaf / Clean for Potato)
          "/LateBlight04.jpg", // South (Late Blight)
          "/LateBlight04.jpg", // West (Late Blight)
          "/03gb.jpg"           // Centre (Grape leaf / Clean for Potato)
        ];
      } else {
        targetCrop = "Soybean";
        imagePaths = [
          "/LateBlight04.jpg",
          "/LateBlight04.jpg",
          "/LateBlight04.jpg",
          "/LateBlight04.jpg",
          "/LateBlight04.jpg"
        ];
      }

      setCropType(targetCrop);
      if (!landSize) setLandSize("10");

      for (let i = 0; i < REQUIRED_ZONES.length; i++) {
        const zoneId = REQUIRED_ZONES[i];
        const res = await fetch(imagePaths[i]);
        const blob = await res.blob();
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        await analyzeZoneImage(zoneId, base64);
      }
    } catch (err) {
      console.error("Failed to load test sample set:", err);
      setScanError("Could not load sample images. Please try uploading manually.");
    }
  };

  /**
   * GENERATE FINAL FIELD ASSESSMENT REPORT
   * Requires all 5 spatial positions to have completed analysis.
   */
  async function handleRunFieldAssessment() {
    const analyzedCount = zoneSamples.filter((s) => s.status === "analyzed" && s.image).length;
    if (analyzedCount < MIN_REQUIRED_SAMPLES) {
      setScanError(
        `All 5 spatial sampling positions (North, East, South, West, Centre) must be captured and analyzed before generating the field assessment. (${analyzedCount}/5 completed)`
      );
      return;
    }

    setIsScanning(true);
    setGeneratingReport(true);
    setScanError(null);
    setResult(null);

    try {
      const finalAcres = Number(landSize) || 1;
      const detectedCrop = cropType || "Crop";

      // LAYER A: Field Assessment Layer
      const aggregatedResult = aggregateFieldAssessment({
        crop: detectedCrop,
        fieldArea: finalAcres,
        condition: conditionQuality,
        materialState: materialType,
        burningContext: burningRisk,
        insuranceContext: insuranceInterest,
        feedContext: feedRecoveryInterest,
        communityContext: communityExchangeInterest,
        industrialContext: industrialProcessingInterest,
        problemDistribution,
        damageLossDate: damageLossDate || null,
        reportedDamageExtent: reportedDamageExtent || "not_sure",
        sampledSections: ["North", "East", "South", "West", "Centre"],
        samples: zoneSamples
      });

      if (!aggregatedResult.isAdequate) {
        throw new Error(aggregatedResult.error || "Field assessment blocked: insufficient samples.");
      }

      // LAYER C: Commercial Context (Downstream only)
      const commercialContextObj = {
        availableQuantity: commercialQuantity ? Number(commercialQuantity) : null,
        quantityUnit: commercialUnit || "kg",
        availableFrom: availableFromDate || null,
        state: commercialState || "",
        district: commercialDistrict || "",
        village: commercialVillage || "",
        expectedPrice: expectedPrice ? Number(expectedPrice) : null,
        openToBuyerOffers: openToOffers,
        sellingPreferences: sellingPreferences || []
      };

      // Retrieve GPS location metadata
      const user = await mockApi.auth.me();
      const effectiveUserId = user?.userId || user?.id || "default_user";
      const savedLoc = await getSavedLocation(effectiveUserId);

      const locationMetadata = (savedLoc && typeof savedLoc.latitude === "number" && typeof savedLoc.longitude === "number")
        ? {
            latitude: Number(savedLoc.latitude),
            longitude: Number(savedLoc.longitude),
            accuracy: Number(savedLoc.accuracy || 0),
            city: savedLoc.city || null,
            district: savedLoc.district || null,
            state: savedLoc.state || null,
            country: savedLoc.country || null,
            capturedAt: savedLoc.capturedAt || savedLoc.timestamp || Date.now()
          }
        : null;

      const fullStructuredResult = {
        ...aggregatedResult,
        location: locationMetadata,
        fieldContext: {
          areaAcres: finalAcres,
          condition: conditionQuality,
          materialState: materialType,
          problemDistribution,
          sampledSections: ["North", "East", "South", "West", "Centre"]
        },
        operationalContext: {
          burningAlternativeNeeded: burningRisk,
          insuranceClaimDocumentation: insuranceInterest,
          livestockFeedIntent: feedRecoveryInterest,
          communityExchangeInterest,
          industrialProcessingInterest
        },
        commercialContext: commercialContextObj,
        samples: zoneSamples
      };

      // Persist scan assessment record to IndexedDB
      await mockApi.entities.ViabilityScan.create({
        cropName: aggregatedResult.cropName || cropType || "Crop",
        image: zoneSamples[0]?.image || null,
        sampleCount: zoneSamples.length,
        fieldArea: finalAcres,
        location: locationMetadata,
        usablePercentage: aggregatedResult.usablePercentage,
        damagePercentage: aggregatedResult.damagePercentage,
        condition: aggregatedResult.condition,
        conditionLabel: aggregatedResult.conditionLabel,
        fieldVisualConcern: aggregatedResult.fieldVisualConcern,
        sampleConsistencyText: aggregatedResult.sampleConsistencyText,
        positiveZonesText: aggregatedResult.positiveZonesText,
        positiveZonesCount: aggregatedResult.positiveZonesCount,
        samplingRepresentation: aggregatedResult.samplingRepresentation,
        zoneResults: aggregatedResult.zoneResults,
        highestConfidence: aggregatedResult.highestConfidence,
        avgPositiveConfidence: aggregatedResult.avgPositiveConfidence,
        avgVisualCoverage: aggregatedResult.visualCoverage,
        action: aggregatedResult.finalRecommendation?.action || "No action provided",
        recommendedFeature: aggregatedResult.finalRecommendation?.feature || "None",
        reason: aggregatedResult.finalRecommendation?.reason || "",
        confidence: aggregatedResult.routingConfidence || "Moderate",
        routingConfidence: aggregatedResult.routingConfidence || "Moderate",
        safetyNote: aggregatedResult.safetyNote || null,
        missingContextNotice: aggregatedResult.missingContextNotice || null,
        date: aggregatedResult.date || new Date().toISOString().split("T")[0],
        primaryDisease: aggregatedResult.primaryDisease,
        detectedDiseases: aggregatedResult.detectedDiseases,
        pathwayScores: aggregatedResult.pathwayScores || {},
        farmerContext: aggregatedResult.farmerContext,
        commercialContext: commercialContextObj,
        samples: zoneSamples.map((s) => ({
          id: s.id,
          zone: s.zone,
          label: s.label,
          image: s.image,
          primaryDisease: s.primaryDisease,
          confidence: s.confidence,
          visualCoverage: s.visualCoverage,
          hasDisease: s.hasDisease,
          conditionKey: s.conditionKey
        }))
      });

      // Auto-log Carbon Cash activity if burning risk
      if (burningRisk === "yes" || (aggregatedResult.damagePercentage >= 50 && materialType === "crop_residue")) {
        const co2_saved = finalAcres * 850;
        const credits = co2_saved / 1000;
        const value = credits * 500;

        await mockApi.entities.CarbonActivity.create({
          activity_type: "composting",
          area_acres: finalAcres,
          description: `Auto-logged from 5-Point Spatial Field Assessment (${aggregatedResult.positiveZonesCount}/5 positive zones in ${aggregatedResult.cropName})`,
          co2_saved_kg: co2_saved,
          credits_earned: credits,
          credit_value_inr: value,
          farmer_name: user?.full_name || user?.name || "Farmer",
          status: "verified"
        });
      }

      setResult(fullStructuredResult);
      setActiveInspectorZone("north");

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch (err) {
      console.error("Scan assessment failed:", err);
      setScanError(err.message || "Failed to execute field assessment.");
    } finally {
      setIsScanning(false);
      setGeneratingReport(false);
      loadHistory();
    }
  }

  const analyzedZonesCount = zoneSamples.filter((s) => s.status === "analyzed" && s.image).length;
  const isAnyAnalyzing = zoneSamples.some((s) => s.status === "analyzing") || isScanning;
  const canRunAssessment = analyzedZonesCount === MIN_REQUIRED_SAMPLES && !isAnyAnalyzing;

  const dmg = result ? damageColors[result.condition] || damageColors.medium : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Banner */}
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Leaf className="h-6 w-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {t("scanner.title") || "Field Viability Scanner"}
          </h1>
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 rounded-full px-2.5 py-0.5 ml-1">
            5-Point Spatial Sampling
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Deterministic 5-zone field assessment (North, East, South, West, Centre) with local on-device YOLO diagnostics.
        </p>
      </div>

      {/* Main Input Form Card */}
      <div className="bg-card rounded-3xl border border-border/80 p-6 sm:p-7 space-y-5 shadow-xs">

        {/* SECTION 1: Crop & Field Information */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
            <Sprout className="h-4 w-4 text-primary" /> 1. Crop & Field Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Standing Crop Name (e.g., Tomato, Potato, Maize, Rice, Grape, Soybean)
              </label>
              <Input
                placeholder="Standing Crop Name"
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Cultivated Land (Acres) — <span className="text-primary font-normal">Used to describe sampling representation</span>
              </label>
              <Input
                type="number"
                placeholder="Field Area in Acres (e.g. 2, 10, 20)"
                value={landSize}
                onChange={(e) => setLandSize(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Condition & Quality */}
        <div className="pt-2 border-t border-border/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-primary" /> 2. {t("scanner.conditionQuality") || "Condition & Quality"}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              { id: "fresh_market_grade", label: t("scanner.conditionQualityTypes.fresh_market_grade") || "Fresh / Market Grade" },
              { id: "slightly_damaged", label: t("scanner.conditionQualityTypes.slightly_damaged") || "Slightly Damaged" },
              { id: "off_grade", label: t("scanner.conditionQualityTypes.off_grade") || "Off-Grade" },
              { id: "surplus", label: t("scanner.conditionQualityTypes.surplus") || "Surplus" },
              { id: "other", label: t("scanner.conditionQualityTypes.other") || "Other" },
              { id: "not_sure", label: t("scanner.conditionQualityTypes.not_sure") || "Not sure" }
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setConditionQuality(opt.id)}
                className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                  conditionQuality === opt.id
                    ? "bg-primary/10 border-primary text-primary font-semibold shadow-xs"
                    : "bg-muted/20 border-border/70 text-foreground hover:bg-muted/40"
                }`}
              >
                <span>{opt.label}</span>
                {conditionQuality === opt.id && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 3: Field & Operational Context Selector */}
        <div className="border border-border/80 rounded-2xl bg-muted/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowContextOptions(!showContextOptions)}
            className="w-full flex items-center justify-between p-3.5 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <span>3. Field & Operational Context</span>
              <span className="text-[11px] font-normal text-muted-foreground hidden sm:inline">
                (Distribution, material state, and operational factors)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {showContextOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>

          {showContextOptions && (
            <div className="p-4 pt-2 border-t border-border/60 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Problem Distribution */}
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">
                    {t("scanner.problemDistribution") || "Problem Distribution"}
                  </label>
                  <select
                    value={problemDistribution}
                    onChange={(e) => setProblemDistribution(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="unknown">{t("scanner.problemDistributionTypes.unknown") || "Not sure / Unknown"}</option>
                    <option value="widespread">{t("scanner.problemDistributionTypes.widespread") || "Appears widespread"}</option>
                    <option value="localized">{t("scanner.problemDistributionTypes.localized") || "Appears localized"}</option>
                  </select>
                </div>

                {/* Material / Crop State */}
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">
                    {t("scanner.materialType") || "Material / Crop State"}
                  </label>
                  <select
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="standing_crop">{t("scanner.materialTypes.standing_crop") || "Standing Field Crop"}</option>
                    <option value="crop_residue">{t("scanner.materialTypes.crop_residue") || "Harvested Crop Residue / Stalks"}</option>
                    <option value="fodder">{t("scanner.materialTypes.fodder") || "Green Fodder / Biomass"}</option>
                    <option value="damaged_produce">{t("scanner.materialTypes.damaged_produce") || "Damaged / Blemished Produce"}</option>
                    <option value="manure">{t("scanner.materialTypes.manure") || "Agricultural Biomass / Manure"}</option>
                    <option value="unknown">{t("scanner.materialTypes.unknown") || "Unspecified / Standing Foliage"}</option>
                  </select>
                </div>

                {/* Open Burning Alternative Needed? */}
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">
                    Open Burning Alternative Needed?
                  </label>
                  <select
                    value={burningRisk}
                    onChange={(e) => setBurningRisk(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                {/* Seeking Insurance Claim Documentation? */}
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">
                    Seeking Insurance Claim Documentation?
                  </label>
                  <select
                    value={insuranceInterest}
                    onChange={(e) => setInsuranceInterest(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                {/* Intended for Livestock Feed? */}
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">
                    Intended for Livestock Feed?
                  </label>
                  <select
                    value={feedRecoveryInterest}
                    onChange={(e) => setFeedRecoveryInterest(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                {/* Reported Crop Damage Extent (Farmer observation) */}
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1 flex items-center justify-between">
                    <span>{t("scanner.reportedDamageExtent") || "Reported Crop Damage Extent"}</span>
                    <span className="text-[10px] text-muted-foreground/80 font-normal">(Farmer observation)</span>
                  </label>
                  <select
                    value={reportedDamageExtent}
                    onChange={(e) => setReportedDamageExtent(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="not_sure">{t("scanner.reportedDamageExtents.not_sure") || "Not sure"}</option>
                    <option value="entire_field_fully_damaged">{t("scanner.reportedDamageExtents.entire_field_fully_damaged") || "Entire field / fully damaged"}</option>
                    <option value="more_than_half">{t("scanner.reportedDamageExtents.more_than_half") || "More than half"}</option>
                    <option value="less_than_half">{t("scanner.reportedDamageExtents.less_than_half") || "Less than half"}</option>
                    <option value="localized_area">{t("scanner.reportedDamageExtents.localized_area") || "Localized area"}</option>
                  </select>
                </div>

                {/* Damage / Loss Date (shown conditionally when damage/insurance is relevant) */}
                {(insuranceInterest === "yes" || conditionQuality === "slightly_damaged" || conditionQuality === "off_grade" || conditionQuality === "other" || materialType === "damaged_produce" || reportedDamageExtent !== "not_sure") && (
                  <div>
                    <label className="block text-muted-foreground font-semibold mb-1 flex items-center justify-between">
                      <span>{t("scanner.damageLossDate") || "Damage / Loss Date"}</span>
                      <span className="text-[10px] text-primary font-normal">PMFBY Intimation Context</span>
                    </label>
                    <input
                      type="date"
                      value={damageLossDate}
                      onChange={(e) => setDamageLossDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-xs focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: 5-Point Spatial Sampling UI */}
        <div className="pt-2 border-t border-border/60 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" /> 4. Fixed 5-Point Spatial Sampling
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Capture 1 representative crop/leaf image from each of the 5 positions: <strong>North, East, South, West, Centre</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 rounded-full"
                onClick={() => setShowBoxes(!showBoxes)}
              >
                <Eye className="h-3.5 w-3.5" />
                {showBoxes ? "Hide Boxes" : "Show Boxes"}
              </Button>

              <Badge
                variant={analyzedZonesCount === 5 ? "default" : "outline"}
                className={`text-xs px-3 py-1 font-bold rounded-full transition-all ${
                  analyzedZonesCount === 5
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                Spatial Zones: {analyzedZonesCount}/5 Analyzed
                {analyzedZonesCount === 5 ? " ✓ Ready" : " (5 Required)"}
              </Badge>
            </div>
          </div>

          {/* VISUAL FIELD LAYOUT SCHEMATIC */}
          <SpatialFieldLayout
            zoneSamples={zoneSamples}
            activeZone={activeZone}
            onSelectZone={(z) => setActiveZone(z)}
            onUploadTrigger={(z) => {
              setActiveZone(z);
              // Trigger upload modal/picker for zone
            }}
          />

          {/* Quick-Filter Navigation Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-muted-foreground font-semibold mr-1">
                Field Positions:
              </span>
              {INITIAL_ZONES_CONFIG.map((cfg) => {
                const sample = zoneSamples.find((s) => s.zone === cfg.zone);
                const isDone = sample?.status === "analyzed";
                const isRunning = sample?.status === "analyzing";
                const isErr = sample?.status === "failed";
                return (
                  <Button
                    key={cfg.zone}
                    type="button"
                    variant={activeZone === cfg.zone ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveZone(cfg.zone)}
                    className={`text-xs rounded-full h-7 gap-1 px-3 ${
                      activeZone === cfg.zone ? "bg-primary text-primary-foreground font-bold" : ""
                    }`}
                  >
                    <span>{cfg.icon}</span>
                    <span>{cfg.label}</span>
                    <span className={`w-2 h-2 rounded-full ml-1 ${
                      isDone
                        ? sample?.hasDisease ? "bg-rose-500" : "bg-emerald-500"
                        : isRunning
                        ? "bg-amber-400 animate-ping"
                        : isErr
                        ? "bg-rose-500"
                        : "bg-stone-300 dark:bg-stone-600"
                    }`} />
                  </Button>
                );
              })}
            </div>

            {/* Quick Test Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[11px] font-semibold mr-1">Presets:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadTestSampleSet("potato")}
                disabled={isAnyAnalyzing}
                className="text-[10px] rounded-full h-6 px-2 border-border/80 hover:bg-primary/10"
              >
                🥔 5 Late Blight
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadTestSampleSet("mixed")}
                disabled={isAnyAnalyzing}
                className="text-[10px] rounded-full h-6 px-2 border-border/80 hover:bg-primary/10"
              >
                🌿 3 Dis + 2 Clean
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadTestSampleSet("clean")}
                disabled={isAnyAnalyzing}
                className="text-[10px] rounded-full h-6 px-2 border-border/80 hover:bg-primary/10"
              >
                🍃 5 Clean
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setZoneSamples(createEmptyZoneSamples());
                  setResult(null);
                  setScanError(null);
                }}
                disabled={isAnyAnalyzing}
                className="text-xs text-rose-600 hover:text-rose-700 h-6 px-2"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* FIVE DEDICATED SPATIAL ZONE CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
            {INITIAL_ZONES_CONFIG.map((cfg) => {
              const sample = zoneSamples.find((s) => s.zone === cfg.zone);
              return (
                <SpatialZoneCard
                  key={cfg.zone}
                  zoneConfig={cfg}
                  sample={sample}
                  onUploadImage={handleZoneUpload}
                  onRetry={handleRetryZone}
                  onRemove={handleRemoveZone}
                  showBoxes={showBoxes}
                  getDiseaseName={getDiseaseName}
                  t={t}
                  language={language}
                />
              );
            })}

            {/* Bulk Upload Dropzone Helper */}
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/90 rounded-2xl p-4 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all bg-muted/20 min-h-[220px] text-center shadow-xs group">
              <div className="h-12 w-12 rounded-2xl bg-secondary text-primary flex items-center justify-center mb-2.5 border border-primary/20 shadow-xs group-hover:scale-105 transition-transform">
                <Upload className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-foreground">
                Bulk 5-Point Upload
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px] leading-tight">
                Select 5 photos at once to populate North, East, South, West & Centre
              </p>
              <input
                ref={bulkFileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleBulkUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* SECTION 5: Commercial & Marketplace Details (Optional) */}
        <div className="border border-border/80 rounded-2xl bg-muted/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCommercialOptions(!showCommercialOptions)}
            className="w-full flex items-center justify-between p-3.5 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              <span>5. Commercial & Marketplace Details (Optional)</span>
              <span className="text-[11px] font-normal text-muted-foreground hidden sm:inline">
                (For buyer matching, quantity off-take & downstream listing)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {showCommercialOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>

          {showCommercialOptions && (
            <div className="p-4 pt-2 border-t border-border/60 space-y-4 text-xs">
              <p className="text-[11px] text-muted-foreground bg-card/60 p-2.5 rounded-xl border border-border/60">
                💡 <em>Note: Commercial and location details are used strictly for downstream marketplace matching and buyer connection. They do not affect the AI visual disease diagnosis.</em>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">
                    Available Quantity
                  </label>
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      placeholder="e.g. 500"
                      value={commercialQuantity}
                      onChange={(e) => setCommercialQuantity(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                    <select
                      value={commercialUnit}
                      onChange={(e) => setCommercialUnit(e.target.value)}
                      className="rounded-xl border border-border bg-card px-2 text-xs text-foreground"
                    >
                      <option value="kg">kg</option>
                      <option value="quintals">quintals</option>
                      <option value="tonnes">tonnes</option>
                      <option value="bags">bags</option>
                      <option value="crates">crates</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">
                    Available From / Harvest Date
                  </label>
                  <Input
                    type="date"
                    value={availableFromDate}
                    onChange={(e) => setAvailableFromDate(e.target.value)}
                    className="rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">
                    Expected Price (₹ / {commercialUnit})
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g. 20"
                    value={expectedPrice}
                    onChange={(e) => setExpectedPrice(e.target.value)}
                    className="rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">State</label>
                  <Input
                    placeholder="e.g. Tamil Nadu"
                    value={commercialState}
                    onChange={(e) => setCommercialState(e.target.value)}
                    className="rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">District</label>
                  <Input
                    placeholder="e.g. Cuddalore"
                    value={commercialDistrict}
                    onChange={(e) => setCommercialDistrict(e.target.value)}
                    className="rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Village / Town</label>
                  <Input
                    placeholder="e.g. Panruti"
                    value={commercialVillage}
                    onChange={(e) => setCommercialVillage(e.target.value)}
                    className="rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 space-y-2">
                <label className="block text-muted-foreground font-semibold">
                  Selling & Buyer Preferences
                </label>
                <div className="flex flex-wrap gap-2">
                  {SELLING_PREFERENCES_OPTIONS.map((opt) => {
                    const isSelected = sellingPreferences.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleSellingPreference(opt.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                            : "bg-card border-border/80 text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>

                <label className="flex items-center gap-2 pt-1.5 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openToOffers}
                    onChange={(e) => setOpenToOffers(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Open to negotiable buyer offers</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Error Banner */}
        {scanError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 rounded-2xl p-4 flex items-start gap-3 text-xs sm:text-sm">
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Assessment Notice</p>
              <p className="text-xs mt-0.5 leading-relaxed">{scanError}</p>
            </div>
          </div>
        )}

        {/* Action Button: RUN FIELD ASSESSMENT */}
        <Button
          onClick={handleRunFieldAssessment}
          disabled={!canRunAssessment || generatingReport}
          className={`w-full gap-2.5 py-6 text-base font-semibold rounded-2xl shadow-sm transition-all ${
            canRunAssessment ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg" : ""
          }`}
        >
          {generatingReport ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
              <span>Compiling 5-Zone Field Assessment Report...</span>
            </>
          ) : isAnyAnalyzing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
              <span>Running Live YOLO Inference ({analyzedZonesCount}/5 zones analyzed)...</span>
            </>
          ) : analyzedZonesCount < MIN_REQUIRED_SAMPLES ? (
            <>
              <Compass className="h-5 w-5" />
              <span>Capture all 5 spatial positions to proceed ({analyzedZonesCount}/5 zones completed)</span>
            </>
          ) : (
            <>
              <Play className="h-5 w-5 fill-current" />
              <span>
                {result
                  ? "Re-Generate Field Assessment (5 Zones Analyzed)"
                  : "Generate Field Assessment (All 5 Zones Ready)"}
              </span>
            </>
          )}
        </Button>
      </div>

      {/* FINAL FIELD ASSESSMENT RESULTS SECTION */}
      <div ref={resultsRef}>
        <AnimatePresence>
          {result && (() => {
            const conditionKey = result.conditionKey || result.condition || (result.damagePercentage > 60 ? "critical" : result.damagePercentage > 30 ? "high" : result.damagePercentage > 10 ? "medium" : "low");
            const dmg = damageColors[conditionKey] || damageColors.low;

            const scannerSpokenText = (() => {
              if (!result) return "";
              const crop = getCropName(result.cropName || "Crop");
              const zones = `${result.positiveZonesCount} of 5 sampled zones positive`;
              let pathway = "";
              if (result.finalRecommendation) {
                const locReason = getLocalizedDecisionText(
                  result.finalRecommendation.reason,
                  result.finalRecommendation.reasonKey,
                  result.finalRecommendation.reasonParams,
                  t
                );
                pathway = `Recommendation: ${result.finalRecommendation.feature}. ${locReason}`;
              }
              return `${crop}. Field Evidence Assessment: ${zones}. Visual Concern: ${result.fieldVisualConcern}. Representation: ${result.samplingRepresentation?.summary || "Stated acreage"}. ${pathway}`.trim();
            })();

            const isMarketplacePathway =
              result.finalRecommendation?.feature === PATHWAY_NAMES.URBAN_WASTE_MATCHER ||
              result.finalRecommendation?.feature === PATHWAY_NAMES.AGRO_CONNECT ||
              result.finalRecommendation?.feature === PATHWAY_NAMES.SILAGE_BANK;

            return (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`bg-card rounded-3xl border ${dmg?.border} p-6 sm:p-7 space-y-6 shadow-sm`}
              >
                {/* ============================================================== */}
                {/* LAYER A: FIELD EVIDENCE ASSESSMENT                             */}
                {/* ============================================================== */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start flex-wrap gap-2 border-b border-border/70 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                          LAYER A — FIELD EVIDENCE ASSESSMENT
                        </span>
                        <Badge variant="outline" className="text-xs font-semibold rounded-full">
                          📐 {result.fieldArea} Acres (Field Context Only)
                        </Badge>
                      </div>
                      <h2 className="font-bold text-2xl sm:text-3xl text-foreground mt-1.5 flex items-center gap-2">
                        <span>🌾 Crop:</span>
                        <span>{getCropName(result.cropName)}</span>
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("common.date")}: {result.date} • Fixed 5-Point Spatial Sampling
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <VoiceButton text={scannerSpokenText} />
                      <Badge className={`${dmg?.bg} px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full shadow-xs`}>
                        {result.fieldVisualConcern || result.conditionLabel}
                      </Badge>
                    </div>
                  </div>

                  {/* Geo-Tagged Farm Location Metadata */}
                  <div className="bg-muted/40 p-4 rounded-2xl border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        <span>📍 Location</span>
                      </div>
                      {result.location ? (
                        <div>
                          <p className="font-bold text-sm sm:text-base text-foreground">
                            {[result.location.city, result.location.state, result.location.country].filter(Boolean).join(", ") || result.location.district || "Farm Location"}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            Coordinates: {formatCoordinate(result.location.latitude, 4)}° N, {formatCoordinate(result.location.longitude, 4)}° E {result.location.accuracy ? `(±${Math.round(result.location.accuracy)} m)` : ""}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-foreground text-xs">Location not available</p>
                          <p className="text-[11px] text-muted-foreground">No GPS coordinates saved in profile.</p>
                        </div>
                      )}
                    </div>

                    <div className="sm:border-l sm:border-border/60 sm:pl-4 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Assessment Date
                      </span>
                      <strong className="text-foreground text-xs">
                        {result.date || new Date().toISOString().split("T")[0]}
                      </strong>
                    </div>
                  </div>

                  {/* SPATIAL SAMPLING 5-POINT BREAKDOWN LIST */}
                  <div className="bg-secondary/30 rounded-2xl p-4 sm:p-5 border border-border/80 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Crosshair className="h-4 w-4 text-primary" /> 📍 Spatial Sampling Positions
                      </h4>
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        5 Fixed Zones Analyzed
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                      {INITIAL_ZONES_CONFIG.map((cfg) => {
                        const zRes = result.zoneResults?.[cfg.zone] || result.samples?.find((s) => s.zone === cfg.zone);
                        const hasDis = zRes?.hasDisease;
                        return (
                          <div
                            key={cfg.zone}
                            className={`p-3 rounded-xl border text-xs space-y-1 ${
                              hasDis
                                ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900"
                                : "bg-card border-border/80"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <strong className="text-foreground font-bold">{cfg.label}</strong>
                              <span className={`w-2 h-2 rounded-full ${hasDis ? "bg-rose-500" : "bg-emerald-500"}`} />
                            </div>
                            <p className="text-[11px] font-medium text-foreground truncate">
                              {hasDis ? (zRes.primaryDisease ? getDiseaseName(zRes.primaryDisease) : "Disease detected") : "No disease-specific indicator"}
                            </p>
                            <div className="flex justify-between text-[10px] text-muted-foreground pt-0.5">
                              <span>Conf: {((zRes?.confidence || 0) * 100).toFixed(0)}%</span>
                              <span>Cov: {zRes?.visualCoverage || 0}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Key Evidence Callout Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Positive Zones Evidence */}
                    <div className="bg-rose-50/60 dark:bg-rose-950/20 rounded-2xl p-4 border border-rose-200/80 dark:border-rose-900/50">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-rose-800 dark:text-rose-300">
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                        <span>🦠 Positive Zones</span>
                      </div>
                      <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1.5">
                        {result.positiveZonesCount} / 5 <span className="text-sm font-semibold text-foreground">sampled zones</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                        {result.zoneEvidenceText || `${result.positiveZonesCount} of 5 sampled field zones showed disease indicators.`}
                      </p>
                    </div>

                    {/* Visual Disease Concern */}
                    <div className="bg-secondary/50 rounded-2xl p-4 border border-border/80">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>📊 Visual Disease Concern</span>
                      </div>
                      <p className="text-base font-bold text-foreground mt-1.5 uppercase truncate">
                        {result.fieldVisualConcern || result.conditionLabel}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Strongest confidence: {(result.highestConfidence * 100).toFixed(1)}% • Visual index: {result.damagePercentage}%
                      </p>
                    </div>

                    {/* Sampling Representation (Acreage matters here!) */}
                    <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200/80 dark:border-amber-900/50">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-800 dark:text-amber-300">
                        <Info className="h-4 w-4 text-amber-600" />
                        <span>⚠️ Sampling Representation</span>
                      </div>
                      <p className="text-sm font-bold text-foreground mt-1.5 leading-snug">
                        {result.samplingRepresentation?.summary || result.samplingRepresentation?.label || "Stated Field Size"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                        {result.samplingRepresentation?.recommendation || "Standard 5-point spatial sampling is indicative."}
                      </p>
                    </div>
                  </div>

                  {/* Sampling Consistency & Agronomic Safeguard Note */}
                  <div className="bg-muted/40 p-4 sm:p-5 rounded-2xl space-y-2 border border-border/80">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                      <Info className="h-4 w-4 text-primary" />
                      <span>Field Evidence Findings</span>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground font-semibold">
                      🔍 {result.positiveZonesCount} / 5 sampled field zones showed disease indicators
                      {result.primaryDisease ? ` (${getDiseaseName(result.primaryDisease) || result.primaryDisease}).` : "."}
                    </p>
                    {result.samplingRepresentation?.detail && (
                      <p className="text-xs text-muted-foreground">
                        • {result.samplingRepresentation.detail}
                      </p>
                    )}
                    <div className="pt-2 border-t border-border/60">
                      <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                        ⚠️ <strong>Agronomic Rule:</strong> {result.disclaimer || "This assessment is based on the 5 submitted representative spatial samples. It does NOT calculate or claim an affected acreage percentage (never '60% of field' or '3/5 acres'). Cultivated acreage describes sampling representation only."}
                      </p>
                    </div>
                  </div>

                  {/* Interactive Position Inspector Canvas */}
                  <div className="space-y-3 pt-2 border-t border-border/70">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" /> Spatial Position Inspector
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 rounded-full"
                        onClick={() => setShowBoxes(!showBoxes)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {showBoxes ? "Hide Boxes" : "Show Boxes"}
                      </Button>
                    </div>

                    {/* Zone Tabs */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {INITIAL_ZONES_CONFIG.map((cfg) => {
                        const isSelected = activeInspectorZone === cfg.zone;
                        const zSample = result.samples?.find((s) => s.zone === cfg.zone) || {};
                        const sampleDis = zSample.primaryDisease;
                        return (
                          <button
                            key={cfg.zone}
                            type="button"
                            onClick={() => setActiveInspectorZone(cfg.zone)}
                            className={`p-2.5 rounded-xl border text-left transition-all relative ${
                              isSelected
                                ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                                : "border-border/70 bg-card hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-xs font-bold text-foreground truncate">{cfg.label}</span>
                              <span className={`text-[9px] px-1 py-0.5 rounded font-semibold uppercase ${zSample.hasDisease ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                                {zSample.hasDisease ? "Disease" : "Clean"}
                              </span>
                            </div>
                            <p className="text-[11px] truncate font-medium text-foreground/80">
                              {sampleDis ? getDiseaseName(sampleDis) : "Clean Foliage"}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {sampleDis ? `${((zSample.confidence || 0) * 100).toFixed(1)}% Conf` : "No disease"}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Canvas Overlay */}
                    {activeInspectorSample && (
                      <div className="bg-card rounded-2xl border border-border/80 p-4 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                          <div>
                            <span className="font-bold text-foreground text-sm">
                              {activeInspectorSample.label || activeInspectorZone.toUpperCase()} Position — {activeInspectorSample.primaryDisease ? getDiseaseName(activeInspectorSample.primaryDisease) : "No disease-specific indicator"}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              (Confidence: {((activeInspectorSample.confidence || 0) * 100).toFixed(1)}% • Visual Coverage: {activeInspectorSample.visualCoverage || 0}%)
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] rounded-full uppercase">
                            Spatial Zone: {activeInspectorSample.label || activeInspectorZone}
                          </Badge>
                        </div>

                        <div className="relative w-full aspect-video bg-black/5 rounded-xl overflow-hidden flex items-center justify-center max-h-[380px]">
                          <canvas
                            ref={canvasRef}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 2: FARMER CONTEXT & OPERATIONAL INTENT                 */}
                {/* ============================================================== */}
                {/* ============================================================== */}
                {/* SECTION 2: FARMER CONTEXT & OPERATIONAL INTENT                 */}
                {/* ============================================================== */}
                <div className="pt-4 border-t border-border/70 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <SlidersHorizontal className="h-4 w-4 text-primary" /> FARMER CONTEXT & OPERATIONAL INTENT
                    </h3>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      Farmer Reported (Evaluated Separately from AI Scan)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border/70">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Condition & Quality</span>
                      <strong className="text-foreground text-xs mt-0.5 block capitalize">
                        {t(`scanner.conditionQualityTypes.${conditionQuality}`) || conditionQuality.replace(/_/g, " ")}
                      </strong>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border/70">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Reported Damage Extent</span>
                      <strong className="text-foreground text-xs mt-0.5 block capitalize">
                        {t(`scanner.reportedDamageExtents.${result.reportedDamageExtent || reportedDamageExtent}`) || (result.reportedDamageExtent || reportedDamageExtent || "Not sure").replace(/_/g, " ")}
                      </strong>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border/70">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Damage / Loss Date</span>
                      <strong className="text-foreground text-xs mt-0.5 block">
                        {result.damageLossDate || damageLossDate || "Not specified"}
                      </strong>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border/70">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Problem Distribution</span>
                      <strong className="text-foreground text-xs mt-0.5 block capitalize">
                        {t(`scanner.problemDistributionTypes.${problemDistribution}`) || problemDistribution}
                      </strong>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border/70">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Seeking Insurance Claim Doc</span>
                      <strong className={`text-xs mt-0.5 block uppercase font-bold ${insuranceInterest === "yes" ? "text-emerald-600" : insuranceInterest === "no" ? "text-rose-600" : "text-muted-foreground"}`}>
                        {insuranceInterest}
                      </strong>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border/70">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Material / Crop State</span>
                      <strong className="text-foreground text-xs mt-0.5 block capitalize">
                        {t(`scanner.materialTypes.${materialType}`) || materialType.replace(/_/g, " ")}
                      </strong>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border/70">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Burning Alternative Needed</span>
                      <strong className={`text-xs mt-0.5 block uppercase font-bold ${burningRisk === "yes" ? "text-emerald-600" : burningRisk === "no" ? "text-rose-600" : "text-muted-foreground"}`}>
                        {burningRisk}
                      </strong>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-xl border border-border/70">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Livestock Feed Intent</span>
                      <strong className={`text-xs mt-0.5 block uppercase font-bold ${feedRecoveryInterest === "yes" ? "text-emerald-600" : feedRecoveryInterest === "no" ? "text-rose-600" : "text-muted-foreground"}`}>
                        {feedRecoveryInterest}
                      </strong>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    ℹ️ Note: Farmer-reported observations and AI optical detections are kept distinct to ensure objective and transparent loss documentation.
                  </p>
                </div>

                {/* ============================================================== */}
                {/* LAYER B: AGROCYCLE RECOMMENDATION (Decision Engine Routing)    */}
                {/* ============================================================== */}
                {result.finalRecommendation && (
                  <div className="space-y-4 pt-4 border-t border-border/70">
                    <div className={`rounded-2xl border-2 p-5 space-y-3 shadow-xs ${
                      result.finalRecommendation.feature === PATHWAY_NAMES.CLAIM_ROCKET && (result.finalRecommendation.isPriorityPath || result.isPriorityPath)
                        ? "bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/50"
                        : "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30"
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className={`h-5 w-5 ${result.finalRecommendation.feature === PATHWAY_NAMES.CLAIM_ROCKET && (result.finalRecommendation.isPriorityPath || result.isPriorityPath) ? "text-amber-600 dark:text-amber-400" : "text-primary"}`} />
                          <span className={`font-bold text-sm uppercase tracking-wider ${result.finalRecommendation.feature === PATHWAY_NAMES.CLAIM_ROCKET && (result.finalRecommendation.isPriorityPath || result.isPriorityPath) ? "text-amber-700 dark:text-amber-300" : "text-primary"}`}>
                            {result.finalRecommendation.feature === PATHWAY_NAMES.CLAIM_ROCKET && (result.finalRecommendation.isPriorityPath || result.isPriorityPath)
                              ? "CLAIM ROCKET — PRIORITY PATH"
                              : "LAYER B — DETERMINISTIC AGROCYCLE RECOMMENDATION"}
                          </span>
                        </div>
                        <Badge className={`${confidenceBadges[result.routingConfidence] || confidenceBadges.Moderate} text-xs font-semibold rounded-full`}>
                          Routing Confidence: {result.routingConfidence}
                        </Badge>
                      </div>

                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-foreground">
                            {result.finalRecommendation.feature === PATHWAY_NAMES.CLAIM_ROCKET && (result.finalRecommendation.isPriorityPath || result.isPriorityPath)
                              ? "Claim Rocket (PMFBY Priority Handoff)"
                              : result.finalRecommendation.feature}
                          </h3>
                          <p className="text-xs text-primary font-semibold mt-0.5">
                            Action: {result.finalRecommendation.action}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {result.finalRecommendation.feature === PATHWAY_NAMES.CLAIM_ROCKET ? (
                            <Button
                              onClick={handleLaunchClaimRocket}
                              className={`rounded-xl shadow-xs gap-1.5 text-xs font-bold cursor-pointer ${
                                (result.finalRecommendation.isPriorityPath || result.isPriorityPath)
                                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
                              }`}
                            >
                              <span>{result.finalRecommendation.action || "Start Claim Rocket →"}</span>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                onClick={handleLaunchAgroConnect}
                                className="rounded-xl shadow-xs gap-1.5 text-xs font-semibold cursor-pointer"
                              >
                                <Users className="h-4 w-4 text-primary" />
                                <span>Share with Farmers</span>
                              </Button>
                              <Button
                                onClick={() => handleLaunchPathway(result.finalRecommendation.feature, result.finalRecommendation.route || PATHWAY_ROUTES[result.finalRecommendation.feature])}
                                className="rounded-xl shadow-xs gap-1.5 text-xs font-semibold cursor-pointer"
                              >
                                <span>Launch {result.finalRecommendation.feature}</span>
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Traceable Decision Reason */}
                      <div className="bg-card/70 p-3.5 rounded-xl border border-border/70 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Traceable Decision Reason:
                        </span>
                        <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                          {getLocalizedDecisionText(
                            result.finalRecommendation.reason,
                            result.finalRecommendation.reasonKey,
                            result.finalRecommendation.reasonParams,
                            t
                          )}
                        </p>
                      </div>

                      {result.safetyNote && (
                        <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200 bg-amber-50/80 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                          <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <span><strong>Safety Note:</strong> {result.safetyNote}</span>
                        </div>
                      )}

                      {result.missingContextNotice && (
                        <div className="flex items-start gap-2 text-xs text-blue-900 dark:text-blue-200 bg-blue-50/80 dark:bg-blue-950/40 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800">
                          <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span><strong>Pathway Context Notice:</strong> {result.missingContextNotice}</span>
                        </div>
                      )}
                    </div>

                    {/* Detailed 5-Pathway Compatibility Breakdown */}
                    <div className="border border-border/80 rounded-2xl bg-muted/20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowPathwayBreakdown(!showPathwayBreakdown)}
                        className="w-full flex items-center justify-between p-4 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-primary" />
                          <span>Detailed 5-Pathway Compatibility Breakdown</span>
                        </div>
                        {showPathwayBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      {showPathwayBreakdown && (
                        <div className="p-4 pt-1 border-t border-border/60 space-y-2.5">
                          {result.allPathways?.map((pw, pidx) => (
                            <div
                              key={pw.featureId || pw.feature || pidx}
                              className="bg-card p-3 rounded-xl border border-border/70 flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-foreground">{pw.feature}</span>
                                  <Badge className={`${statusBadges[pw.status] || statusBadges.conditional} text-[10px] px-2 py-0 rounded-full font-bold uppercase`}>
                                    {pw.status}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground">Score: {pw.score}/100</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">{pw.reason}</p>
                              </div>
                              {pw.status !== "not eligible" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-[11px] h-7 gap-1 flex-shrink-0 cursor-pointer"
                                  onClick={() => handleLaunchPathway(pw.feature, pw.route || PATHWAY_ROUTES[pw.feature])}
                                >
                                  <span>Open</span>
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* LAYER C: MARKET INTELLIGENCE & COMMERCIAL MATCHING             */}
                {/* ============================================================== */}
                {(isMarketplacePathway || commercialQuantity || commercialDistrict) && (
                  <div className="pt-4 border-t border-border/70 space-y-3">
                    <div className="bg-card rounded-2xl border border-border/80 p-5 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                            LAYER C — MARKET INTELLIGENCE & COMMERCIAL MATCHING
                          </h3>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 rounded-full">
                          Ready for Market Intelligence
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/60">
                          <span className="text-muted-foreground block text-[10px]">Quantity Available</span>
                          <strong className="text-foreground text-xs mt-0.5 block">
                            {commercialQuantity ? `${commercialQuantity} ${commercialUnit}` : "Not specified"}
                          </strong>
                        </div>
                        <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/60">
                          <span className="text-muted-foreground block text-[10px]">Location</span>
                          <strong className="text-foreground text-xs mt-0.5 block truncate">
                            {[commercialVillage, commercialDistrict, commercialState].filter(Boolean).join(", ") || "Tamil Nadu"}
                          </strong>
                        </div>
                        <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/60">
                          <span className="text-muted-foreground block text-[10px]">Expected Price</span>
                          <strong className="text-foreground text-xs mt-0.5 block">
                            {expectedPrice ? `₹${expectedPrice} / ${commercialUnit}` : "Market Offer"}
                          </strong>
                        </div>
                        <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/60">
                          <span className="text-muted-foreground block text-[10px]">Availability Date</span>
                          <strong className="text-foreground text-xs mt-0.5 block">
                            {availableFromDate || "Immediate"}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/50 text-xs">
                        <span className="text-muted-foreground text-[11px]">
                          Preferences: {sellingPreferences.map(p => SELLING_PREFERENCES_OPTIONS.find(o => o.id === p)?.label || p).join(" • ") || "Standard matching"}
                        </span>
                        <Button 
                          size="sm" 
                          onClick={handleLaunchMarketIntelligence}
                          className="gap-1.5 rounded-xl text-xs shadow-xs font-semibold cursor-pointer"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>Explore Market Intelligence →</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* ASSESSMENT HISTORY / FARM HISTORY SECTION */}
      {history.length > 0 && (
        <div className="bg-card rounded-3xl border border-border/80 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-base text-foreground">
                Recent Field Assessments ({history.length})
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Stored locally in IndexedDB • Retains 5-Zone Spatial Evidence & GPS coordinates
            </p>
          </div>

          <div className="space-y-2.5">
            {history.map((scan) => {
              const positiveCount = typeof scan.positiveZonesCount === "number"
                ? `${scan.positiveZonesCount}/5 zones positive`
                : scan.sampleCount
                ? `${scan.sampleCount} Samples`
                : "5 Samples";

              return (
                <div
                  key={scan.id}
                  className="bg-muted/30 p-3.5 rounded-2xl border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-foreground text-sm">{getCropName(scan.cropName || "Crop")}</strong>
                      <Badge variant="outline" className="text-[10px] rounded-full">
                        {scan.fieldArea || 1} Acres
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 rounded-full font-semibold">
                        {positiveCount}
                      </Badge>
                      <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 rounded-full font-semibold">
                        {scan.recommendedFeature || scan.action || "Evaluated"}
                      </Badge>
                    </div>

                    {/* Geo-tagged location metadata in history */}
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      {scan.location ? (
                        <span>
                          {[scan.location.city, scan.location.state, scan.location.country].filter(Boolean).join(", ") || scan.location.district || "Farm Location"}
                          {" "}
                          <span className="font-mono text-[10px]">({formatCoordinate(scan.location.latitude, 4)}° N, {formatCoordinate(scan.location.longitude, 4)}° E)</span>
                        </span>
                      ) : (
                        <span className="italic">Location not available</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right sm:text-right flex sm:flex-col justify-between items-center sm:items-end text-[11px] text-muted-foreground">
                    <span>{scan.date || scan.created_date?.split("T")[0] || "Past Scan"}</span>
                    <span className="text-[10px]">{scan.samplingRepresentation?.label || "5 Spatial Zones"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}