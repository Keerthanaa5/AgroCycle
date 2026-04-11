import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Save, Loader2, Star, Recycle, Leaf, CircleDollarSign, ScanLine, FileCheck } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "../components/dashboard/StatCard";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: "", user_type: "farmer", phone: "", location: "",
    language: "english", aadhar_number: "", date_of_birth: ""
  });
  const [stats, setStats] = useState({ scans: 0, claims: 0, posts: 0, carbon: 0 });

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);

      const profiles = await base44.entities.UserProfile.filter({ created_by: me.email });
      const [scans, claims, posts, carbon] = await Promise.all([
        base44.entities.ViabilityScan.list().catch(() => []),
        base44.entities.InsuranceClaim.list().catch(() => []),
        base44.entities.CropPost.list().catch(() => []),
        base44.entities.CarbonActivity.list().catch(() => []),
      ]);
      setStats({ scans: scans.length, claims: claims.length, posts: posts.length, carbon: carbon.length });

      if (profiles.length > 0) {
        setProfile(profiles[0]);
        setForm({
          display_name: profiles[0].display_name || me.full_name || "",
          user_type: profiles[0].user_type || "farmer",
          phone: profiles[0].phone || "",
          location: profiles[0].location || "",
          language: profiles[0].language || "english",
          aadhar_number: profiles[0].aadhar_number || "",
          date_of_birth: profiles[0].date_of_birth || "",
        });
      } else {
        setForm(f => ({ ...f, display_name: me.full_name || "" }));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    if (profile) {
      await base44.entities.UserProfile.update(profile.id, form);
    } else {
      const created = await base44.entities.UserProfile.create(form);
      setProfile(created);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">👤 My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">{user?.email}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Recycle} label="Posts" value={stats.posts} color="primary" />
        <StatCard icon={ScanLine} label="Scans" value={stats.scans} color="blue" />
        <StatCard icon={Leaf} label="Eco Activities" value={stats.carbon} color="green" />
        <StatCard icon={FileCheck} label="Claims" value={stats.claims} color="amber" />
      </div>

      {/* Profile Form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl border border-border p-6 space-y-4"
      >
        <h2 className="font-bold text-lg">Profile Settings</h2>
        
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Name</label>
            <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">User Type</label>
            <Select value={form.user_type} onValueChange={v => setForm(f => ({ ...f, user_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="farmer">👨‍🌾 Farmer</SelectItem>
                <SelectItem value="cattle_owner">🐄 Cattle Owner</SelectItem>
                <SelectItem value="buyer">🛒 Buyer</SelectItem>
                <SelectItem value="transporter">🚚 Transporter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Phone</label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Location</label>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Language</label>
            <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="telugu">తెలుగు (Telugu)</SelectItem>
                <SelectItem value="hindi">हिन्दी (Hindi)</SelectItem>
                <SelectItem value="marathi">मराठी (Marathi)</SelectItem>
                <SelectItem value="kannada">ಕನ್ನಡ (Kannada)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Date of Birth</label>
            <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1 block">Aadhar Number</label>
            <Input value={form.aadhar_number} onChange={e => setForm(f => ({ ...f, aadhar_number: e.target.value }))} placeholder="XXXX-XXXX-XXXX" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Profile</>}
        </Button>
      </motion.div>
    </div>
  );
}