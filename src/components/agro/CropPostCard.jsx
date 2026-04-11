import { motion } from "framer-motion";
import { MapPin, Package, Phone, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const conditionColors = {
  fresh: "bg-emerald-100 text-emerald-700",
  slightly_damaged: "bg-amber-100 text-amber-700",
  damaged: "bg-orange-100 text-orange-700",
  weeds: "bg-lime-100 text-lime-700",
};

const statusColors = {
  available: "bg-emerald-100 text-emerald-700",
  reserved: "bg-amber-100 text-amber-700",
  exchanged: "bg-blue-100 text-blue-700",
};

export default function CropPostCard({ post, index, onRefresh }) {
  const whatsappUrl = post.contact_phone
    ? `https://wa.me/${post.contact_phone.replace(/[^0-9]/g, '')}?text=Hi, I saw your post "${post.title}" on Farmer Rescue AI`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card rounded-2xl border border-border p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <Badge variant="secondary" className={post.post_type === "offering_waste" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}>
          {post.post_type === "offering_waste" ? "🌾 Offering" : "🐄 Requesting"}
        </Badge>
        <Badge variant="secondary" className={statusColors[post.status] || ""}>
          {post.status}
        </Badge>
      </div>

      {post.image_url && (
        <img src={post.image_url} alt={post.title} className="w-full h-36 object-cover rounded-xl mb-3" />
      )}
      <h3 className="font-bold text-foreground mb-2">{post.title}</h3>
      
      <div className="space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5" />
          <span>{post.crop_type} • {post.quantity_kg} kg • <span className={`px-1.5 py-0.5 rounded text-xs ${conditionColors[post.condition] || ""}`}>{post.condition}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5" />
          <span>{post.location}</span>
        </div>
        {post.farmer_name && (
          <p className="text-xs">By: <span className="font-medium text-foreground">{post.farmer_name}</span></p>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </a>
        )}
        {post.contact_phone && (
          <a href={`tel:${post.contact_phone}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-2">
              <Phone className="h-4 w-4" /> Call
            </Button>
          </a>
        )}
      </div>
    </motion.div>
  );
}