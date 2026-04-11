import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Leaf, TrendingUp, Loader2, CircleDollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import StatCard from "../components/dashboard/StatCard";

const CREDIT_RATE = 50; // ₹50 per credit

export default function CarbonCash() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [form, setForm] = useState({ activity_type: "composting", area_acres: "", description: "" });

  useEffect(() => { loadActivities(); }, []);

  async function loadActivities() {
    setLoading(true);
    const data = await base44.entities.CarbonActivity.list("-created_date", 50);
    setActivities(data);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setCalcLoading(true);
    const user = await base44.auth.me();
    
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Calculate estimated CO2 savings for: Activity: ${form.activity_type}, Area: ${form.area_acres} acres, Description: ${form.description}. Give realistic estimates for Indian farming.`,
      response_json_schema: {
        type: "object",
        properties: {
          co2_saved_kg: { type: "number" },
          credits_earned: { type: "number" },
          explanation: { type: "string" }
        }
      }
    });

    await base44.entities.CarbonActivity.create({
      activity_type: form.activity_type,
      area_acres: Number(form.area_acres),
      description: form.description,
      co2_saved_kg: result.co2_saved_kg || 0,
      credits_earned: result.credits_earned || 0,
      credit_value_inr: (result.credits_earned || 0) * CREDIT_RATE,
      farmer_name: user.full_name,
    });

    setCalcLoading(false);
    setDialogOpen(false);
    setForm({ activity_type: "composting", area_acres: "", description: "" });
    loadActivities();
  }

  const totalCO2 = activities.reduce((s, a) => s + (a.co2_saved_kg || 0), 0);
  const totalCredits = activities.reduce((s, a) => s + (a.credits_earned || 0), 0);
  const totalValue = activities.reduce((s, a) => s + (a.credit_value_inr || 0), 0);

  const statusColors = {
    pending: "bg-amber-100 text-amber-700",
    verified: "bg-blue-100 text-blue-700",
    credited: "bg-emerald-100 text-emerald-700",
    sold: "bg-purple-100 text-purple-700",
  };

  const activityLabels = {
    composting: "🌿 Composting",
    no_burn: "🚫 No Burn",
    organic_farming: "🌱 Organic Farming",
    water_conservation: "💧 Water Conservation",
    tree_planting: "🌳 Tree Planting",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">💰 Carbon Cash</h1>
          <p className="text-muted-foreground text-sm mt-1">Earn carbon credits for eco-friendly farming</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Log Activity</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Log Eco Activity</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select value={form.activity_type} onValueChange={v => setForm(f => ({ ...f, activity_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="composting">🌿 Composting</SelectItem>
                  <SelectItem value="no_burn">🚫 No Crop Burning</SelectItem>
                  <SelectItem value="organic_farming">🌱 Organic Farming</SelectItem>
                  <SelectItem value="water_conservation">💧 Water Conservation</SelectItem>
                  <SelectItem value="tree_planting">🌳 Tree Planting</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" placeholder="Area (acres)" value={form.area_acres} onChange={e => setForm(f => ({ ...f, area_acres: e.target.value }))} required />
              <Input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <Button type="submit" className="w-full gap-2" disabled={calcLoading}>
                {calcLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Calculating...</> : "Log & Calculate Credits"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Leaf} label="CO₂ Saved" value={`${totalCO2.toFixed(1)} kg`} color="green" />
        <StatCard icon={TrendingUp} label="Credits" value={totalCredits.toFixed(1)} color="blue" />
        <StatCard icon={CircleDollarSign} label="Value" value={`₹${totalValue.toFixed(0)}`} color="amber" />
      </div>

      {/* Activities */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Leaf className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No activities logged. Start earning carbon credits!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act, i) => (
            <motion.div key={act.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{activityLabels[act.activity_type] || act.activity_type}</span>
                  <Badge className={statusColors[act.status]}>{act.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{act.area_acres} acres{act.description ? ` • ${act.description}` : ""}</p>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="text-center"><p className="font-bold text-emerald-600">{act.co2_saved_kg?.toFixed(1)} kg</p><p className="text-xs text-muted-foreground">CO₂ saved</p></div>
                <div className="text-center"><p className="font-bold text-blue-600">{act.credits_earned?.toFixed(1)}</p><p className="text-xs text-muted-foreground">Credits</p></div>
                <div className="text-center"><p className="font-bold text-amber-600">₹{act.credit_value_inr?.toFixed(0)}</p><p className="text-xs text-muted-foreground">Value</p></div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}