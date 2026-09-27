import { useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Package,
  Phone,
  MessageCircle,
  Image as ImageIcon,
  Trash2,
  HelpCircle,
  Lightbulb,
  HandHelping,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Send,
  UserCheck,
  Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/i18n";
import { isRecordOwner } from "@/services/roleManager";
import VerifiedBadge from "@/components/VerifiedBadge";
import SyncStatusBadge from "@/components/SyncStatusBadge";
import { syncManager } from "@/services/syncManager";

const conditionColors = {
  fresh: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  slightly_damaged: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  damaged: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
  weeds: "bg-lime-50 text-lime-800 border-lime-200 dark:bg-lime-950/40 dark:text-lime-300 dark:border-lime-800",
};

const postTypeBadges = {
  offering_waste: {
    labelKey: "postTypeOffering",
    defaultLabel: "🌾 Offering Crop Waste",
    style: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
  },
  requesting_resource: {
    labelKey: "postTypeRequesting",
    defaultLabel: "🌱 Requesting Crop Resource",
    style: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300"
  },
  seeking_advice: {
    labelKey: "postTypeAdvice",
    defaultLabel: "❓ Seeking Crop Advice",
    style: "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300"
  },
  sharing_knowledge: {
    labelKey: "postTypeKnowledge",
    defaultLabel: "💡 Sharing Crop Knowledge",
    style: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300"
  }
};

export default function CropPostCard({ post, index, onRefresh, onDelete, onInteract, onAcceptConnection }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [interactModalOpen, setInteractModalOpen] = useState(false);
  const [interactionType, setInteractionType] = useState("interested");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [showInteractions, setShowInteractions] = useState(false);

  const isOwner = isRecordOwner(post, user);
  const currentUserId = user?.userId || user?.id;

  // Check if current user is connected with this post
  const isConnected = Array.isArray(post.connections) && post.connections.some(c => c.farmer_id === currentUserId && c.status === 'connected');
  const userInteracted = Array.isArray(post.interactions) && post.interactions.some(i => i.farmer_id === currentUserId);

  const typeConfig = postTypeBadges[post.post_type] || postTypeBadges.offering_waste;
  const typeLabel = t(`agroConnect.${typeConfig.labelKey}`, {}, typeConfig.defaultLabel);

  const conditionDisplay = post.condition ? t(`agroConnect.conditions.${post.condition}`, {}, post.condition?.replace("_", " ")) : null;

  function handleOpenInteract(type) {
    setInteractionType(type);
    setMessage("");
    setInteractModalOpen(true);
  }

  function handleSendInteraction(e) {
    if (e) e.preventDefault();
    if (!onInteract) return;
    onInteract(post.id, {
      farmer_id: currentUserId,
      farmer_name: user?.name || user?.full_name || "Neighboring Farmer",
      interaction_type: interactionType,
      message,
      contact_phone: phone
    });
    setInteractModalOpen(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-card rounded-3xl border border-border/80 p-5 shadow-natural hover:shadow-natural-lg hover:border-primary/30 transition-all flex flex-col justify-between group"
    >
      <div>
        <div className="flex items-start justify-between mb-3 gap-2">
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${typeConfig.style}`}>
            {typeLabel}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {isOwner && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {language === "ta" ? "எனது பதிவு" : language === "hi" ? "मेरी पोस्ट" : "My Post"}
              </span>
            )}
            {isConnected && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300">
                {t("agroConnect.actions.connected", {}, "✅ Connected")}
              </span>
            )}
            <SyncStatusBadge 
              status={post.sync_status} 
              onRetry={() => {
                const uid = user?.userId || user?.id;
                if (uid) {
                  syncManager.processQueue(uid).catch(() => {});
                }
              }}
            />
          </div>
        </div>

        {post.image ? (
          <div className="overflow-hidden rounded-2xl mb-3.5 border border-border/60 shadow-xs aspect-[16/9]">
            <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
          </div>
        ) : (
          <div className="w-full aspect-[16/9] bg-muted/20 flex items-center justify-center rounded-2xl mb-3.5 border border-border/80 border-dashed">
            <ImageIcon className="h-8 w-8 text-muted-foreground opacity-30" />
          </div>
        )}

        <h3 className="font-bold text-base sm:text-lg text-foreground mb-1.5 tracking-tight">{post.title}</h3>
        
        {post.description && post.description !== post.title && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
            {post.description}
          </p>
        )}

        <div className="space-y-1.5 text-xs text-muted-foreground">
          {/* Crop & Topic / Resource specific info */}
          <div className="flex items-center gap-2 flex-wrap">
            <Package className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-foreground font-semibold">{post.crop_type}</span>
            {post.topic && (
              <span className="px-2 py-0.5 rounded-full bg-muted font-medium text-[11px] border border-border/60">
                {post.topic}
              </span>
            )}
            {post.resource_needed && (
              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 font-medium text-[11px] border border-sky-300">
                {post.resource_needed}
              </span>
            )}
            {post.quantity_kg > 0 && (
              <span className="text-foreground font-medium">
                • {post.quantity_kg} {t("common.kg")}
              </span>
            )}
            {conditionDisplay && (
              <span className={`px-2 py-0.5 rounded-full font-medium border text-[11px] ${conditionColors[post.condition] || ""}`}>
                {conditionDisplay}
              </span>
            )}
          </div>

          {post.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{post.location}</span>
            </div>
          )}
          
          <div className="pt-2.5 border-t border-border/60 mt-3 flex items-center justify-between text-xs">
            <span>
              {language === "ta" ? "விவசாயி: " : language === "hi" ? "किसान: " : "Farmer: "}
              <strong className="text-foreground font-semibold">{post.farmer_name || "Community Farmer"}</strong>
            </span>
            {post.creatorId ? (
              <VerifiedBadge status={post.creatorVerificationStatus || "verified"} />
            ) : (
              <span className="text-muted-foreground text-[10px] italic">Verified Member</span>
            )}
          </div>
        </div>
      </div>

      {/* Action / Interaction Section */}
      <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
        {!isOwner && (
          <div className="flex gap-2 flex-wrap">
            {post.post_type === "offering_waste" && (
              <Button
                size="sm"
                onClick={() => handleOpenInteract("interested")}
                className="flex-1 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t("agroConnect.actions.interested", {}, "🌾 Interested")}
              </Button>
            )}

            {post.post_type === "requesting_resource" && (
              <Button
                size="sm"
                onClick={() => handleOpenInteract("offer_help")}
                className="flex-1 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
              >
                <HandHelping className="h-3.5 w-3.5" />
                {t("agroConnect.actions.offerHelp", {}, "🌱 Offer Help")}
              </Button>
            )}

            {(post.post_type === "seeking_advice" || post.post_type === "sharing_knowledge") && (
              <Button
                size="sm"
                onClick={() => handleOpenInteract("reply")}
                className="flex-1 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {t("agroConnect.actions.reply", {}, "💬 Reply")}
              </Button>
            )}

            {/* If already connected, show call/whatsapp direct buttons */}
            {isConnected && post.phone && (
              <div className="flex gap-2 w-full mt-2">
                <a href={`tel:${post.phone}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl text-xs border-emerald-300 text-emerald-800 dark:text-emerald-300">
                    <Phone className="h-3.5 w-3.5" /> Call Farmer
                  </Button>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Owner View: Show incoming interactions & Accept button */}
        {isOwner && (
          <div className="space-y-2">
            {Array.isArray(post.interactions) && post.interactions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInteractions(!showInteractions)}
                className="w-full justify-between text-xs rounded-xl border-border/80"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" />
                  {t("agroConnect.actions.viewInteractions", { count: post.interactions.length }, `Farmer Responses (${post.interactions.length})`)}
                </span>
                {showInteractions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}

            {showInteractions && Array.isArray(post.interactions) && (
              <div className="bg-muted/30 rounded-2xl p-3 border border-border/70 space-y-2 text-xs">
                {post.interactions.map((int, i) => {
                  const isConn = Array.isArray(post.connections) && post.connections.some(c => c.farmer_id === int.farmer_id);
                  return (
                    <div key={int.id || i} className="bg-card p-2.5 rounded-xl border border-border/60 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <strong className="text-foreground">{int.farmer_name}</strong>
                        <span className="text-[10px] text-muted-foreground capitalize">{int.interaction_type?.replace("_", " ")}</span>
                      </div>
                      {int.message && <p className="text-muted-foreground italic">"{int.message}"</p>}
                      <div className="flex items-center justify-between pt-1">
                        {int.contact_phone && isConn ? (
                          <span className="text-emerald-700 dark:text-emerald-300 font-medium">📞 {int.contact_phone}</span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">Contact protected until connected</span>
                        )}
                        {!isConn ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onAcceptConnection && onAcceptConnection(post.id, int.farmer_id, int.farmer_name)}
                            className="h-7 text-[11px] rounded-lg px-2.5 font-medium gap-1"
                          >
                            <UserCheck className="h-3 w-3" /> {t("agroConnect.actions.acceptConnection", {}, "Accept Connection")}
                          </Button>
                        ) : (
                          <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Connected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {onDelete && (
              <Button
                onClick={() => onDelete(post.id)}
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:bg-destructive/10 gap-1.5 text-xs rounded-xl"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {language === "ta" ? "எனது பதிவை நீக்கு" : language === "hi" ? "मेरी पोस्ट हटाएं" : "Delete My Post"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Quick Farmer Response Modal */}
      <Dialog open={interactModalOpen} onOpenChange={setInteractModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {interactionType === "offer_help" ? "Offer Help to Farmer" : interactionType === "reply" ? "Reply to Crop Post" : "Connect with Farmer"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendInteraction} className="space-y-4 pt-2">
            <div className="bg-muted/40 p-3 rounded-2xl border border-border/80 text-xs">
              <p className="font-semibold text-foreground">{post.title}</p>
              <p className="text-muted-foreground mt-0.5">{post.crop_type} • {post.farmer_name} • {post.location}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Your Message</label>
              <Textarea
                placeholder={interactionType === "offer_help" ? "Describe how you can assist (e.g. I have organic manure/residue nearby)..." : "Write your response or question..."}
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Your Contact Phone (Shared when connected)</label>
              <Input
                placeholder="Phone number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <Button type="submit" className="w-full rounded-2xl py-5 gap-2 font-semibold">
              <Send className="h-4 w-4" /> {t("agroConnect.actions.sendResponse", {}, "Send Response")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}