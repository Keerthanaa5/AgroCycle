import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileCheck, Upload, Loader2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function ClaimRocket() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [form, setForm] = useState({
    farmer_name: "", mobile_number: "", aadhar_number: "", date_of_birth: "",
    crop_type: "", damage_type: "flood", location: "", area_acres: ""
  });

  useEffect(() => { loadClaims(); }, []);

  async function loadClaims() {
    setLoading(true);
    const data = await base44.entities.InsuranceClaim.list("-created_date", 50);
    setClaims(data);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    let imageUrl = "";
    if (imageFile) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
      imageUrl = file_url;
    }

    // AI analysis of damage
    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze crop insurance claim: Crop: ${form.crop_type}, Damage: ${form.damage_type}, Area: ${form.area_acres} acres, Location: ${form.location}. Estimate damage percentage, estimated loss in INR, and recommended claim amount. Generate a formal damage assessment report.`,
      file_urls: imageUrl ? [imageUrl] : undefined,
      response_json_schema: {
        type: "object",
        properties: {
          damage_percentage: { type: "number" },
          estimated_loss_inr: { type: "number" },
          claim_amount_inr: { type: "number" },
          report: { type: "string" }
        }
      }
    });

    const claim = await base44.entities.InsuranceClaim.create({
      ...form,
      area_acres: Number(form.area_acres),
      damage_image_url: imageUrl,
      damage_percentage: analysis.damage_percentage,
      estimated_loss_inr: analysis.estimated_loss_inr,
      claim_amount_inr: analysis.claim_amount_inr,
      ai_report: analysis.report,
      status: "submitted",
    });
    // Notify farmer of successful submission
    const me = await base44.auth.me();
    await base44.entities.Notification.create({
      type: "claim_update",
      title: "📄 Claim Submitted!",
      message: `Your insurance claim for ${form.crop_type} has been submitted. Estimated claim: ₹${analysis.claim_amount_inr?.toLocaleString()}.`,
      recipient_email: me.email,
      link: "/claim-rocket",
      is_read: false,
    });
    setSubmitting(false);
    setDialogOpen(false);
    setImageFile(null);
    setForm({ farmer_name: "", mobile_number: "", aadhar_number: "", date_of_birth: "", crop_type: "", damage_type: "flood", location: "", area_acres: "" });
    loadClaims();
  }

  const statusConfig = {
    draft: { color: "bg-slate-100 text-slate-700", icon: Clock },
    submitted: { color: "bg-blue-100 text-blue-700", icon: Clock },
    under_review: { color: "bg-amber-100 text-amber-700", icon: AlertCircle },
    approved: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
    rejected: { color: "bg-red-100 text-red-700", icon: XCircle },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">📄 Claim Rocket</h1>
          <p className="text-muted-foreground text-sm mt-1">Fast insurance claims with AI-powered damage assessment</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Claim</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>File Insurance Claim</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input placeholder="Full Name" value={form.farmer_name} onChange={e => setForm(f => ({ ...f, farmer_name: e.target.value }))} required />
              <Input placeholder="Mobile Number" value={form.mobile_number} onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))} required />
              <Input placeholder="Aadhar Number" value={form.aadhar_number} onChange={e => setForm(f => ({ ...f, aadhar_number: e.target.value }))} required />
              <Input type="date" placeholder="Date of Birth" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} required />
              <Input placeholder="Crop Type" value={form.crop_type} onChange={e => setForm(f => ({ ...f, crop_type: e.target.value }))} required />
              <Select value={form.damage_type} onValueChange={v => setForm(f => ({ ...f, damage_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flood">🌊 Flood</SelectItem>
                  <SelectItem value="drought">☀️ Drought</SelectItem>
                  <SelectItem value="pest">🐛 Pest</SelectItem>
                  <SelectItem value="disease">🦠 Disease</SelectItem>
                  <SelectItem value="hailstorm">🌨️ Hailstorm</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              <Input type="number" placeholder="Area (acres)" value={form.area_acres} onChange={e => setForm(f => ({ ...f, area_acres: e.target.value }))} />
              
              <label className="flex flex-col items-center border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-all">
                {imageFile ? (
                  <p className="text-sm text-primary font-medium">{imageFile.name}</p>
                ) : (
                  <><Upload className="h-6 w-6 text-muted-foreground mb-2" /><p className="text-xs text-muted-foreground">Upload damage photo</p></>
                )}
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0])} className="hidden" />
              </label>

              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : <><FileCheck className="h-4 w-4" /> Submit Claim</>}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No claims filed. File your first claim!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((claim, i) => {
            const sc = statusConfig[claim.status] || statusConfig.draft;
            const Icon = sc.icon;
            return (
              <motion.div key={claim.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card rounded-2xl border border-border p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold">{claim.farmer_name}</h3>
                      <Badge className={sc.color}><Icon className="h-3 w-3 mr-1" />{claim.status?.replace("_", " ")}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <p>Crop: <span className="text-foreground">{claim.crop_type}</span></p>
                      <p>Damage: <span className="text-foreground capitalize">{claim.damage_type}</span></p>
                      <p>Area: <span className="text-foreground">{claim.area_acres} acres</span></p>
                      <p>Damage: <span className="text-foreground">{claim.damage_percentage}%</span></p>
                    </div>
                    {claim.claim_amount_inr > 0 && (
                      <p className="text-sm mt-2 font-semibold text-primary">Claim Amount: ₹{claim.claim_amount_inr?.toLocaleString()}</p>
                    )}
                    {claim.ai_report && (
                      <details className="mt-3">
                        <summary className="text-sm text-primary cursor-pointer font-medium">View AI Report</summary>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{claim.ai_report}</p>
                      </details>
                    )}
                  </div>
                  {claim.damage_image_url && (
                    <img src={claim.damage_image_url} alt="Damage" className="w-24 h-24 rounded-xl object-cover" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}