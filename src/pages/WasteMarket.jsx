import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Store, MapPin, IndianRupee, Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function WasteMarket() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [matchLoading, setMatchLoading] = useState(null);
  const [form, setForm] = useState({
    crop_type: "", quantity_kg: "", condition: "slightly_damaged",
    location: "", asking_price: "", farmer_name: "", contact_phone: ""
  });

  useEffect(() => { loadListings(); }, []);

  async function loadListings() {
    setLoading(true);
    const data = await base44.entities.WasteMatch.list("-created_date", 50);
    setListings(data);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setUploadingImage(true);
    const user = await base44.auth.me();
    let imageUrl = "";
    if (imageFile) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
      imageUrl = file_url;
    }
    setUploadingImage(false);
    await base44.entities.WasteMatch.create({
      ...form,
      quantity_kg: Number(form.quantity_kg),
      asking_price: Number(form.asking_price) || 0,
      farmer_name: form.farmer_name || user.full_name,
      image_url: imageUrl,
    });
    setDialogOpen(false);
    setImageFile(null);
    setForm({ crop_type: "", quantity_kg: "", condition: "slightly_damaged", location: "", asking_price: "", farmer_name: "", contact_phone: "" });
    loadListings();
  }

  async function findBuyer(listing) {
    setMatchLoading(listing.id);
    const me = await base44.auth.me();
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Find the best potential buyers for damaged/waste ${listing.crop_type} (${listing.quantity_kg}kg, condition: ${listing.condition}) in ${listing.location}, India. Suggest 3 types of buyers (hotels, food processing units, industries, local buyers) with estimated prices. Return JSON.`,
      response_json_schema: {
        type: "object",
        properties: {
          buyers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                buyer_type: { type: "string" },
                name: { type: "string" },
                estimated_price_per_kg: { type: "number" },
                distance_km: { type: "number" },
                reason: { type: "string" }
              }
            }
          }
        }
      },
      add_context_from_internet: true,
    });

    if (result.buyers && result.buyers.length > 0) {
      const best = result.buyers[0];
      await base44.entities.WasteMatch.update(listing.id, {
        status: "matched",
        matched_buyer: best.name,
        buyer_type: best.buyer_type.includes("hotel") ? "hotel" : best.buyer_type.includes("industr") ? "industry" : best.buyer_type.includes("food") ? "food_processing" : "local_buyer",
      });
      // Notify the listing owner
      await base44.entities.Notification.create({
        type: "buyer_match",
        title: "🛒 Buyer Found!",
        message: `A buyer "${best.name}" was matched for your ${listing.crop_type} (${listing.quantity_kg}kg) at ~₹${best.estimated_price_per_kg}/kg.`,
        recipient_email: me.email,
        link: "/waste-market",
        is_read: false,
      });
    }
    setMatchLoading(null);
    loadListings();
  }

  const statusColors = {
    listed: "bg-blue-100 text-blue-700",
    matched: "bg-amber-100 text-amber-700",
    sold: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">♻️ Urban Waste Matcher</h1>
          <p className="text-muted-foreground text-sm mt-1">Sell damaged crops to hotels, industries & buyers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> List Crop</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>List Damaged Crop</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input placeholder="Crop Type (e.g. Ragi, Rice)" value={form.crop_type} onChange={e => setForm(f => ({ ...f, crop_type: e.target.value }))} required />
              <Input type="number" placeholder="Quantity (kg)" value={form.quantity_kg} onChange={e => setForm(f => ({ ...f, quantity_kg: e.target.value }))} required />
              <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slightly_damaged">Slightly Damaged</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="heavily_damaged">Heavily Damaged</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required />
              <Input type="number" placeholder="Asking Price per kg (₹)" value={form.asking_price} onChange={e => setForm(f => ({ ...f, asking_price: e.target.value }))} />
              <Input placeholder="Your Name" value={form.farmer_name} onChange={e => setForm(f => ({ ...f, farmer_name: e.target.value }))} />
              <Input placeholder="Contact Phone" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
              <label className="flex flex-col items-center border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-all">
                {imageFile ? (
                  <p className="text-sm text-primary font-medium">{imageFile.name}</p>
                ) : (
                  <><Upload className="h-5 w-5 text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">Upload crop photo (optional)</p></>
                )}
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0])} className="hidden" />
              </label>
              <Button type="submit" className="w-full gap-2" disabled={uploadingImage}>
                {uploadingImage ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : "List for Sale"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No listings yet. List your damaged crops!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl border border-border p-5 hover:shadow-lg transition-all"
            >
              {item.image_url && (
                <img src={item.image_url} alt={item.crop_type} className="w-full h-36 object-cover rounded-xl mb-3" />
              )}
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold">{item.crop_type}</h3>
                <Badge className={statusColors[item.status]}>{item.status}</Badge>
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground mb-4">
                <p>📦 {item.quantity_kg} kg • {item.condition?.replace("_", " ")}</p>
                <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {item.location}</p>
                {item.asking_price > 0 && <p className="flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5" /> ₹{item.asking_price}/kg</p>}
                {item.matched_buyer && <p className="text-primary font-medium">🤝 Matched: {item.matched_buyer}</p>}
              </div>
              {item.status === "listed" && (
                <Button onClick={() => findBuyer(item)} disabled={matchLoading === item.id} variant="outline" size="sm" className="w-full gap-2">
                  {matchLoading === item.id ? <><Loader2 className="h-4 w-4 animate-spin" /> Finding Buyers...</> : <><Search className="h-4 w-4" /> Find Buyers</>}
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}