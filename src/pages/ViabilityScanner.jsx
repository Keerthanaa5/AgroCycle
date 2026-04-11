import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanLine, Upload, Loader2, ArrowRight, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const damageColors = {
  low: { bg: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  medium: { bg: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  high: { bg: "bg-orange-100 text-orange-700", icon: AlertTriangle },
  critical: { bg: "bg-red-100 text-red-700", icon: XCircle },
};

const actionLabels = {
  sell: "🛒 Sell to Buyers",
  feed_cattle: "🐄 Feed to Cattle",
  silage: "🏭 Send to Silage",
  compost: "🌿 Compost It",
  insurance_claim: "📄 File Insurance",
  intercrop: "🌱 Intercrop",
};

export default function ViabilityScanner() {
  const [cropType, setCropType] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    const scans = await base44.entities.ViabilityScan.list("-created_date", 20);
    setHistory(scans);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setResult(null);
    }
  }

  async function handleScan() {
    if (!imageFile || !cropType) return;
    setScanning(true);

    const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });

    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this crop image. Crop type: ${cropType}. Determine: 1) usable percentage, 2) damage level (low/medium/high/critical), 3) detailed analysis, 4) recommended action (sell/feed_cattle/silage/compost/insurance_claim/intercrop). Be practical for Indian farmers.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          usable_percentage: { type: "number" },
          damage_level: { type: "string" },
          analysis: { type: "string" },
          recommended_action: { type: "string" },
          additional_tips: { type: "string" }
        }
      }
    });

    const user = await base44.auth.me();
    await base44.entities.ViabilityScan.create({
      crop_type: cropType,
      image_url: file_url,
      usable_percentage: analysis.usable_percentage,
      damage_level: analysis.damage_level,
      ai_analysis: analysis.analysis,
      recommended_action: analysis.recommended_action,
      farmer_name: user.full_name,
    });

    setResult({ ...analysis, image_url: file_url });
    setScanning(false);
    loadHistory();
  }

  const dmg = result ? damageColors[result.damage_level] || damageColors.medium : null;
  const DmgIcon = dmg?.icon || AlertTriangle;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">🌾 Viability Scanner</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload crop image for AI analysis</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <Input placeholder="Crop Type (e.g. Rice, Wheat, Ragi)" value={cropType} onChange={e => setCropType(e.target.value)} />
        
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-all">
          {imagePreview ? (
            <img src={imagePreview} alt="Crop" className="max-h-48 rounded-lg object-cover" />
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Click to upload crop image</p>
            </>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </label>

        <Button onClick={handleScan} disabled={!imageFile || !cropType || scanning} className="w-full gap-2">
          {scanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><ScanLine className="h-4 w-4" /> Scan Crop</>}
        </Button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-card rounded-2xl border border-border p-6 space-y-5"
          >
            <h2 className="font-bold text-lg">📊 Analysis Results</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-primary">{result.usable_percentage}%</p>
                <p className="text-xs text-muted-foreground mt-1">Usable</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${dmg?.bg}`}>
                <DmgIcon className="h-8 w-8 mx-auto mb-1" />
                <p className="text-sm font-bold capitalize">{result.damage_level} Damage</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Analysis</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.analysis}</p>
            </div>

            <div className="bg-primary/5 rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-2">✅ Recommended Action</h3>
              <p className="text-lg font-bold text-primary">{actionLabels[result.recommended_action] || result.recommended_action}</p>
            </div>

            {result.additional_tips && (
              <div>
                <h3 className="font-semibold text-sm mb-2">💡 Tips</h3>
                <p className="text-sm text-muted-foreground">{result.additional_tips}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-lg">📋 Scan History</h2>
          {history.map((scan, i) => {
            const d = damageColors[scan.damage_level] || damageColors.medium;
            return (
              <motion.div key={scan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="bg-card border border-border rounded-2xl p-4 flex gap-4 items-start"
              >
                {scan.image_url && <img src={scan.image_url} alt={scan.crop_type} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{scan.crop_type}</span>
                    <Badge className={d.bg + " text-xs"}>{scan.damage_level}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{scan.ai_analysis}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="text-primary font-bold">{scan.usable_percentage}% usable</span>
                    <span>{actionLabels[scan.recommended_action] || scan.recommended_action}</span>
                    <span>{new Date(scan.created_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}