import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { 
  Users, ShoppingCart, Leaf, ScanLine, Warehouse, 
  FileCheck, Sprout, Bot, TrendingUp, Recycle, CircleDollarSign, Award
} from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import QuickAction from "../components/dashboard/QuickAction";
import { motion } from "framer-motion";

const quickActions = [
  { icon: Users, label: "AgroConnect", description: "Connect with farmers & cattle owners", path: "/agro-connect", color: "primary" },
  { icon: ShoppingCart, label: "Waste Market", description: "Sell damaged crops to buyers", path: "/waste-market", color: "amber" },
  { icon: Leaf, label: "Carbon Cash", description: "Earn from eco-friendly practices", path: "/carbon-cash", color: "green" },
  { icon: ScanLine, label: "Viability Scanner", description: "Analyze crop health with AI", path: "/viability-scanner", color: "blue" },
  { icon: Warehouse, label: "Silage Bank", description: "Convert waste to animal feed", path: "/silage-bank", color: "purple" },
  { icon: FileCheck, label: "Claim Rocket", description: "Fast insurance claims", path: "/claim-rocket", color: "rose" },
  { icon: Sprout, label: "Intercrop Wizard", description: "AI crop suggestions", path: "/intercrop-wizard", color: "teal" },
  { icon: Bot, label: "AI Assistant", description: "Voice & text help in your language", path: "/ai-assistant", color: "secondary" },
];

export default function Dashboard() {
  const [stats, setStats] = useState({ posts: 0, matches: 0, carbon: 0, claims: 0 });
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function load() {
      const [user, posts, matches, carbon, claims] = await Promise.all([
        base44.auth.me(),
        base44.entities.CropPost.list().catch(() => []),
        base44.entities.WasteMatch.list().catch(() => []),
        base44.entities.CarbonActivity.list().catch(() => []),
        base44.entities.InsuranceClaim.list().catch(() => []),
      ]);
      setUserName(user?.full_name || "Farmer");
      setStats({
        posts: posts.length,
        matches: matches.length,
        carbon: carbon.reduce((s, c) => s + (c.co2_saved_kg || 0), 0),
        claims: claims.length,
      });
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Welcome back, <span className="text-primary">{userName}</span> 👋
        </h1>
        <p className="text-muted-foreground mt-2">Convert crop loss into profit using AI, community, and sustainability.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Recycle} label="Community Posts" value={stats.posts} subtitle="Active exchanges" color="primary" />
        <StatCard icon={CircleDollarSign} label="Waste Matches" value={stats.matches} subtitle="Buyer connections" color="amber" />
        <StatCard icon={Leaf} label="CO₂ Saved" value={`${stats.carbon} kg`} subtitle="Carbon credits" color="green" />
        <StatCard icon={Award} label="Claims Filed" value={stats.claims} subtitle="Insurance claims" color="blue" />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action, i) => (
            <QuickAction key={action.path} {...action} index={i} />
          ))}
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-bold text-foreground mb-4">🌾 How It Works</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { step: "1", title: "Upload & Analyze", desc: "Upload crop images for AI analysis" },
            { step: "2", title: "Connect & Exchange", desc: "Find buyers, cattle owners, or silage centers" },
            { step: "3", title: "Earn & Grow", desc: "Earn from sales, carbon credits & insurance" },
          ].map((s) => (
            <div key={s.step} className="flex gap-3 items-start">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">
                {s.step}
              </div>
              <div>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}