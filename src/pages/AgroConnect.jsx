import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MessageCircle, Star, MapPin, Package, Upload, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import CropPostCard from "../components/agro/CropPostCard";

export default function AgroConnect() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    title: "", crop_type: "", quantity_kg: "", condition: "fresh",
    location: "", post_type: "offering_waste", contact_phone: "", farmer_name: ""
  });

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    setLoading(true);
    const data = await base44.entities.CropPost.list("-created_date", 50);
    setPosts(data);
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
    const newPost = await base44.entities.CropPost.create({
      ...form,
      quantity_kg: Number(form.quantity_kg),
      farmer_name: form.farmer_name || user.full_name,
      image_url: imageUrl,
    });
    // Notify all community members about fodder requests
    if (form.post_type === "requesting_fodder") {
      await base44.entities.Notification.create({
        type: "fodder_request",
        title: "🐄 New Fodder Request",
        message: `${form.farmer_name || user.full_name} needs ${form.quantity_kg}kg of fodder near ${form.location}.`,
        recipient_email: user.email,
        link: "/agro-connect",
        is_read: false,
      });
    }
    setDialogOpen(false);
    setImageFile(null);
    setForm({ title: "", crop_type: "", quantity_kg: "", condition: "fresh", location: "", post_type: "offering_waste", contact_phone: "", farmer_name: "" });
    loadPosts();
  }

  const filtered = filter === "all" ? posts : posts.filter(p => p.post_type === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">🌐 AgroConnect Community</h1>
          <p className="text-muted-foreground text-sm mt-1">Exchange crop waste, fodder & manure with your community</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Post</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Post</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select value={form.post_type} onValueChange={v => setForm(f => ({ ...f, post_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="offering_waste">🌾 Offering Crop Waste</SelectItem>
                  <SelectItem value="requesting_fodder">🐄 Requesting Fodder</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Title (e.g. 50kg weeds available)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              <Input placeholder="Crop Type" value={form.crop_type} onChange={e => setForm(f => ({ ...f, crop_type: e.target.value }))} required />
              <Input type="number" placeholder="Quantity (kg)" value={form.quantity_kg} onChange={e => setForm(f => ({ ...f, quantity_kg: e.target.value }))} required />
              <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fresh">Fresh</SelectItem>
                  <SelectItem value="slightly_damaged">Slightly Damaged</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="weeds">Weeds</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required />
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
                {uploadingImage ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : "Post"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { val: "all", label: "All" },
          { val: "offering_waste", label: "🌾 Waste Available" },
          { val: "requesting_fodder", label: "🐄 Fodder Requests" },
        ].map(f => (
          <Button key={f.val} variant={filter === f.val ? "default" : "outline"} size="sm" onClick={() => setFilter(f.val)}>
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No posts yet. Be the first to share!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((post, i) => (
            <CropPostCard key={post.id} post={post} index={i} onRefresh={loadPosts} />
          ))}
        </div>
      )}
    </div>
  );
}