import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sprout, Loader2, Lightbulb, Calendar, IndianRupee } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function IntercropWizard() {
  const [form, setForm] = useState({ current_crop: "", soil_type: "red_soil", location: "", season: "kharif", area_acres: "" });
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  async function handleAnalyze() {
    if (!form.current_crop || !form.location) return;
    setLoading(true);
    
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Suggest intercropping options for an Indian farmer with: Current crop: ${form.current_crop}, Soil: ${form.soil_type}, Location: ${form.location}, Season: ${form.season}, Area: ${form.area_acres} acres. Give 3-4 fast-growing crops suitable for intercropping, with growing period, estimated income, and planting tips. Focus on practical advice for Indian farming conditions.`,
      response_json_schema: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                crop_name: { type: "string" },
                growing_days: { type: "number" },
                estimated_income_per_acre: { type: "number" },
                planting_tips: { type: "string" },
                compatibility_score: { type: "number" },
                seed_availability: { type: "string" }
              }
            }
          },
          general_advice: { type: "string" }
        }
      },
      add_context_from_internet: true,
    });
    
    setSuggestions(result);
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">🌱 Intercrop Wizard</h1>
        <p className="text-muted-foreground text-sm mt-1">AI-powered crop suggestions for extra income</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <Input placeholder="Current Crop (e.g. Rice, Cotton)" value={form.current_crop} onChange={e => setForm(f => ({ ...f, current_crop: e.target.value }))} />
        <Select value={form.soil_type} onValueChange={v => setForm(f => ({ ...f, soil_type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="red_soil">Red Soil</SelectItem>
            <SelectItem value="black_soil">Black Soil</SelectItem>
            <SelectItem value="alluvial">Alluvial Soil</SelectItem>
            <SelectItem value="laterite">Laterite Soil</SelectItem>
            <SelectItem value="sandy">Sandy Soil</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
        <Select value={form.season} onValueChange={v => setForm(f => ({ ...f, season: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="kharif">Kharif (Monsoon)</SelectItem>
            <SelectItem value="rabi">Rabi (Winter)</SelectItem>
            <SelectItem value="zaid">Zaid (Summer)</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" placeholder="Area (acres)" value={form.area_acres} onChange={e => setForm(f => ({ ...f, area_acres: e.target.value }))} />
        <Button onClick={handleAnalyze} disabled={loading || !form.current_crop || !form.location} className="w-full gap-2">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Sprout className="h-4 w-4" /> Get Suggestions</>}
        </Button>
      </div>

      <AnimatePresence>
        {suggestions && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {suggestions.suggestions?.map((crop, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl border border-border p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-lg">🌿 {crop.crop_name}</h3>
                  {crop.compatibility_score && (
                    <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                      {crop.compatibility_score}% match
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> {crop.growing_days} days</div>
                  <div className="flex items-center gap-2"><IndianRupee className="h-4 w-4 text-muted-foreground" /> ₹{crop.estimated_income_per_acre?.toLocaleString()}/acre</div>
                </div>
                <p className="text-sm text-muted-foreground">{crop.planting_tips}</p>
                {crop.seed_availability && <p className="text-xs text-primary mt-2">Seeds: {crop.seed_availability}</p>}
              </motion.div>
            ))}
            {suggestions.general_advice && (
              <div className="bg-accent rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1">General Advice</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{suggestions.general_advice}</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}