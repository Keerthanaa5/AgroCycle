import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { 
  isFarmer, 
  isBuyer, 
  isRecordOwner, 
  canSponsorActivity, 
  canAcceptActivityOffer,
  isActiveFarmer,
  isActiveBuyer
} from "@/services/roleManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Leaf, TrendingUp, Loader2, CircleDollarSign, Check, X, Building2, HandCoins, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { localDB, KEYS } from "@/services/localDB";
import VerifiedBadge from "@/components/VerifiedBadge";
import SyncStatusBadge from "@/components/SyncStatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import { enqueueAction, ACTION_TYPES } from "@/services/syncQueue";
import { syncManager } from "@/services/syncManager";
import { useLanguage } from "@/i18n";

function FarmerLogActivity({ dialogOpen, setDialogOpen, handleSubmit, form, setForm, calcLoading }) {
  const { user, isActiveFarmer: userIsActiveFarmer } = useAuth();
  const { t } = useLanguage();
  if (!userIsActiveFarmer) return null;

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 rounded-xl"><Plus className="h-4 w-4" /> {t("carbonCash.logActivity")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader><DialogTitle className="text-xl font-bold">{t("carbonCash.modalTitle")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/80 text-xs flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">Farmer: {user?.name || user?.full_name}</p>
              <p className="text-muted-foreground text-[11px] mt-0.5">{t("common.contact") || "Phone"}: {user?.phone || "N/A"}</p>
            </div>
            <VerifiedBadge status={user?.verificationStatus} />
          </div>

          <Select value={form.activity_type} onValueChange={v => setForm(f => ({ ...f, activity_type: v }))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="composting">🌿 {t("carbonCash.activityTypes.composting") || "Composting"}</SelectItem>
              <SelectItem value="no_burn">🚫 {t("carbonCash.activityTypes.mulching") || "No Crop Burning"}</SelectItem>
              <SelectItem value="organic_farming">🌱 Organic Farming</SelectItem>
              <SelectItem value="water_conservation">💧 Water Conservation</SelectItem>
              <SelectItem value="tree_planting">🌳 Tree Planting</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" placeholder={t("carbonCash.areaCoveredLabel") || "Area (acres) *"} value={form.area_acres} onChange={e => setForm(f => ({ ...f, area_acres: e.target.value }))} required className="rounded-xl" />
          <Input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="rounded-xl" />
          <Button type="submit" className="w-full gap-2 rounded-2xl py-5" disabled={calcLoading}>
            {calcLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}</> : (t("carbonCash.confirmLog") || "Log & Calculate Credits")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CarbonActivitiesList({ 
  loading, 
  activities, 
  activityLabels, 
  statusColors, 
  handleMakeOffer, 
  handleAcceptOffer, 
  handleRejectOffer 
}) {
  const { user, isActiveFarmer: userIsActiveFarmer, isActiveBuyer: userIsActiveBuyer } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (activities.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground bg-card rounded-3xl border border-border/80 p-8 shadow-xs">
        <Leaf className="h-12 w-12 mx-auto mb-3 opacity-40 text-primary" />
        <p className="font-medium text-foreground">{userIsActiveFarmer ? (t("carbonCash.noActivitiesFarmer") || "No eco-activities logged yet") : (t("carbonCash.noActivitiesBuyer") || "No activities available for funding")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("carbonCash.subtitle")}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {activities.map((act, i) => {
        const currentUserId = user?.userId || user?.id;
        const isOwner = isRecordOwner(act, user);
        const isSelfActivity = Boolean(act.creatorId && currentUserId && act.creatorId === currentUserId);
        const isSelfSponsored = Boolean(act.sponsorId && currentUserId && act.sponsorId === currentUserId);

        return (
          <motion.div key={act.id || i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="bg-card rounded-3xl border border-border/80 p-5 shadow-xs hover:shadow-natural hover:border-primary/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base text-foreground">{activityLabels[act.activity_type] || act.activity_type}</span>
                <SyncStatusBadge 
                  status={act.sync_status} 
                  onRetry={() => {
                    if (user?.userId) {
                      syncManager.processQueue(user.userId).catch(() => {});
                    }
                  }}
                />
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[act.status] || "bg-muted text-muted-foreground"}`}>
                  {act.status === "offer_received" ? (t("carbonCash.offerReceived") || "Offer Received") : (act.status === "accepted" ? (t("carbonCash.sponsorshipConfirmed") || "Sponsorship Confirmed") : act.status)}
                </span>
                {act.creatorVerificationStatus && (
                  <VerifiedBadge status={act.creatorVerificationStatus} />
                )}
                {isSelfActivity && userIsActiveBuyer && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                    {t("carbonCash.yourFarmerPost") || "Your Farmer Post"}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{act.area_acres} acres{act.description ? ` • ${act.description}` : ""}</p>
              
              {/* Creator display for Buyers */}
              {userIsActiveBuyer && (
                <p className="text-xs text-muted-foreground">
                  {t("wasteMarket.sellerLabel") || "Farmer:"} <strong className="text-foreground">{act.farmerName || "Community Farmer"}</strong>
                  {isSelfActivity && <span className="text-amber-700 dark:text-amber-400 font-semibold ml-1">({t("common.you") || "You"})</span>}
                </p>
              )}

              {/* Sponsor info when offer is active or accepted */}
              {(act.status === "offer_received" || act.status === "accepted") && act.sponsorName && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
                  <Building2 className="h-3.5 w-3.5 text-sky-700" />
                  <span>Sponsor: <strong className="text-foreground">{act.sponsorName}</strong></span>
                  {act.sponsorVerificationStatus && (
                    <VerifiedBadge status={act.sponsorVerificationStatus} />
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 text-xs items-start sm:items-center">
              <div className="flex gap-4 items-center bg-muted/40 p-2.5 rounded-2xl border border-border/60">
                <div className="text-center"><p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{act.co2Saved?.toFixed(1)} kg</p><p className="text-[10px] text-muted-foreground">CO₂ saved</p></div>
                <div className="text-center"><p className="font-bold text-sky-700 dark:text-sky-400 text-sm">{act.credits?.toFixed(1)}</p><p className="text-[10px] text-muted-foreground">Credits</p></div>
                <div className="text-center"><p className="font-bold text-amber-700 dark:text-amber-400 text-sm">₹{act.value?.toFixed(0)}</p><p className="text-[10px] text-muted-foreground">Value</p></div>
              </div>
              
              {/* Buyer Action: Submit Sponsorship Commitment */}
              {userIsActiveBuyer && act.status === "pending" && (
                isSelfActivity ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-300 text-xs font-medium">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("carbonCash.antiSelfSponsorshipShort") || "Self-sponsorship disabled"}</span>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => handleMakeOffer(act.id)} className="gap-1.5 rounded-xl h-8">
                    <HandCoins className="h-3.5 w-3.5" /> {t("carbonCash.fundActivity") || "Fund Activity"}
                  </Button>
                )
              )}

              {/* Buyer Indicator after submitting offer */}
              {userIsActiveBuyer && act.status === "offer_received" && (
                act.sponsorId === currentUserId ? (
                  <span className="text-xs text-sky-800 bg-sky-50 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 px-3 py-1 rounded-full font-medium">
                    {t("carbonCash.offerSubmittedAwaiting") || "Offer Submitted (Awaiting Farmer)"}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border">
                    {t("carbonCash.offerUnderReview") || "Offer Under Review"}
                  </span>
                )
              )}

              {/* Farmer Owner Actions: Review and Accept/Reject Buyer Offer */}
              {isOwner && act.status === "offer_received" && (
                isSelfSponsored ? (
                  <div className="text-xs text-destructive bg-destructive/10 px-2.5 py-1 rounded-md font-medium">
                    {t("carbonCash.invalidSelfSponsor") || "Invalid self-sponsored offer"}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAcceptOffer(act.id)} className="gap-1 rounded-xl h-8 text-xs">
                      <Check className="h-3.5 w-3.5" /> {t("carbonCash.acceptOffer") || "Accept Offer"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectOffer(act.id)} className="text-destructive hover:bg-destructive/10 gap-1 rounded-xl h-8 text-xs">
                      <X className="h-3.5 w-3.5" /> {t("carbonCash.decline") || "Decline"}
                    </Button>
                  </div>
                )
              )}
              
              {/* Contact options once offer is accepted */}
              {act.status === "accepted" && (
                <div className="flex gap-2">
                  {(userIsActiveBuyer ? act.phone : act.sponsorPhone) && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs rounded-xl h-8" 
                      onClick={() => {
                        const targetPhone = userIsActiveBuyer ? act.phone : act.sponsorPhone;
                        window.open(`https://wa.me/${targetPhone.replace(/[^0-9]/g, '')}`, "_blank");
                      }}
                    >
                      WhatsApp
                    </Button>
                  )}
                  {(userIsActiveBuyer ? act.phone : act.sponsorPhone) && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs rounded-xl h-8" 
                      onClick={() => {
                        const targetPhone = userIsActiveBuyer ? act.phone : act.sponsorPhone;
                        window.open(`tel:${targetPhone}`);
                      }}
                    >
                      Call
                    </Button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function CarbonCash() {
  const { user, isActiveFarmer: userIsActiveFarmer, isActiveBuyer: userIsActiveBuyer } = useAuth();
  const { t } = useLanguage();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [form, setForm] = useState({ activity_type: "composting", area_acres: "", description: "" });

  useEffect(() => { 
    loadActivities(); 
    const unsub = syncManager.subscribe((event) => {
      if (event.type === "ACTION_SYNCED" || event.type === "SYNC_COMPLETE") {
        loadActivities();
      }
    });
    return () => unsub();
  }, [user]);

  async function loadActivities() {
    setLoading(true);
    let data = [];
    try {
      data = await localDB.async.getData(KEYS.CARBON);
    } catch (e) {
      data = localDB.getData(KEYS.CARBON);
    }
    if (!data || data.length === 0) {
      data = localDB.getData(KEYS.CARBON);
    }

    // Strict ownership filtering for Farmers: show only "My Activities"
    if (isActiveFarmer(user)) {
      data = data.filter(p => isRecordOwner(p, user));
    }
    // Buyers see all activities in the marketplace

    setActivities(data);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isActiveFarmer(user)) {
      alert("Only active Farmers can log carbon activities.");
      return null;
    }

    setCalcLoading(true);
    const acres = Number(form.area_acres) || 0;
    const co2_saved = acres * 850;
    const credits = co2_saved / 1000;
    const value = credits * 500;

    const currentUserId = user.userId || user.id;

    const newPost = {
      id: Date.now().toString(),
      creatorId: currentUserId,
      creatorRole: "farmer",
      creatorName: user.name || user.full_name,
      creatorPhone: user.phone,
      creatorVerificationStatus: user.verificationStatus || "pending",
      activity_type: form.activity_type,
      area_acres: acres,
      description: form.description,
      
      farmerName: user.name || user.full_name,
      phone: user.phone,
      co2Saved: co2_saved,
      credits: credits,
      value: value,
      status: "pending",
      sync_status: "pending",
      sponsorId: null,
      sponsorName: null,
      sponsorPhone: null,
      sponsorRole: null,
      sponsorVerificationStatus: null,
      date: new Date().toISOString()
    };

    localDB.addItem(KEYS.CARBON, newPost);

    // Enqueue in offline sync queue
    enqueueAction({
      userId: currentUserId,
      actionType: ACTION_TYPES.CREATE_CARBON_ACTIVITY,
      entityType: "carbonActivity",
      entityId: newPost.id,
      payload: newPost
    }).then(() => {
      if (syncManager.isOnline()) {
        syncManager.processQueue(currentUserId).catch(() => {});
      }
    }).catch(err => console.warn("[CarbonCash] Enqueue sync error:", err));

    setCalcLoading(false);
    setDialogOpen(false);
    setForm({ activity_type: "composting", area_acres: "", description: "" });
    loadActivities();
  }

  // Buyer submits funding offer / commitment
  function handleMakeOffer(postId) {
    if (!isActiveBuyer(user) && !isBuyer(user)) {
      alert("Only registered Buyers / Companies can submit sponsorship offers.");
      return;
    }

    const currentUserId = user?.userId || user?.id;
    if (!currentUserId) {
      alert("Authentication required to submit an offer.");
      return;
    }

    const allData = localDB.getData(KEYS.CARBON);
    const act = allData.find(a => a.id === postId);

    if (!act) {
      alert("Activity not found.");
      return;
    }

    // STRICT BUSINESS RULE: Anti Self-Sponsorship Enforcement
    if (act.creatorId && act.creatorId === currentUserId) {
      alert("You cannot sponsor your own activity.");
      return;
    }

    const offerPayload = { 
      status: "offer_received", 
      sync_status: "pending",
      sponsorName: user.name || user.full_name || "Commercial Sponsor",
      sponsorId: currentUserId,
      sponsorPhone: user.phone,
      sponsorRole: "buyer",
      sponsorVerificationStatus: user.verificationStatus || "pending"
    };

    localDB.updateItem(KEYS.CARBON, postId, offerPayload);

    // Enqueue offer in offline sync queue
    enqueueAction({
      userId: currentUserId,
      actionType: ACTION_TYPES.SPONSOR_CARBON_ACTIVITY,
      entityType: "carbonActivity",
      entityId: postId,
      payload: { ...act, ...offerPayload }
    }).then(() => {
      if (syncManager.isOnline()) {
        syncManager.processQueue(currentUserId).catch(() => {});
      }
    }).catch(err => console.warn("[CarbonCash] Enqueue offer sync error:", err));

    loadActivities();
  }

  // Farmer accepts buyer's offer (Only creator farmer can accept, cannot accept self-sponsorship)
  function handleAcceptOffer(postId) {
    const allData = localDB.getData(KEYS.CARBON);
    const act = allData.find(a => a.id === postId);
    const currentUserId = user?.userId || user?.id;

    if (!act || !isRecordOwner(act, user)) {
      alert("Only the farmer who logged this activity can accept funding offers.");
      return;
    }

    // STRICT BUSINESS RULE: Cannot accept self-sponsored offer
    if (act.sponsorId && currentUserId && act.sponsorId === currentUserId) {
      alert("You cannot accept a sponsorship offer submitted by your own account.");
      return;
    }

    localDB.updateItem(KEYS.CARBON, postId, { 
      status: "accepted"
    });
    loadActivities();
  }

  // Farmer rejects buyer's offer (Only creator farmer can decline)
  function handleRejectOffer(postId) {
    const allData = localDB.getData(KEYS.CARBON);
    const act = allData.find(a => a.id === postId);

    if (!act || !isRecordOwner(act, user)) {
      alert("Only the farmer who logged this activity can decline funding offers.");
      return;
    }

    localDB.updateItem(KEYS.CARBON, postId, { 
      status: "pending",
      sponsorId: null,
      sponsorName: null,
      sponsorPhone: null,
      sponsorRole: null,
      sponsorVerificationStatus: null
    });
    loadActivities();
  }

  const totalCO2 = activities.reduce((s, a) => s + (a.co2Saved || 0), 0);
  const totalCredits = activities.reduce((s, a) => s + (a.credits || 0), 0);
  const totalValue = activities.reduce((s, a) => s + (a.value || 0), 0);

  const statusColors = {
    pending: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    offer_received: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300",
    accepted: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    verified: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300",
    credited: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    sold: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
  };

  const activityLabels = {
    composting: `🌿 ${t("carbonCash.activityTypes.composting") || "Composting"}`,
    no_burn: `🚫 ${t("carbonCash.activityTypes.mulching") || "No Burn"}`,
    organic_farming: "🌱 Organic Farming",
    water_conservation: "💧 Water Conservation",
    tree_planting: "🌳 Tree Planting",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Leaf className="h-5 w-5 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{t("carbonCash.title")}</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {t("carbonCash.subtitle")}
          </p>
        </div>
        <FarmerLogActivity 
          dialogOpen={dialogOpen} setDialogOpen={setDialogOpen}
          handleSubmit={handleSubmit} form={form} setForm={setForm}
          calcLoading={calcLoading}
        />
      </div>

      {/* Eco-Credit Treasury Hero Banner */}
      <div className="agro-hero-deep p-6 sm:p-7 shadow-natural relative overflow-hidden">
        <div className="absolute right-3 -bottom-6 opacity-10 pointer-events-none text-emerald-300 animate-float-slow">
          <Leaf className="w-48 h-48" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90 bg-black/20 px-3 py-1 rounded-full border border-white/10">
              🌱 {t("carbonCash.badge")}
            </span>
            <span className="text-xs text-emerald-200/80">
              1 Credit = 1,000 kg CO₂ Offset
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-xs border border-white/15">
              <span className="text-xs text-emerald-200/80 block font-medium">CO₂ Offset Total</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white mt-1 block tracking-tight">{totalCO2.toFixed(1)} kg</span>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-xs border border-white/15">
              <span className="text-xs text-emerald-200/80 block font-medium">{t("dashboard.kpis.carbonCredits") || "Carbon Credits"}</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-1 block tracking-tight">{totalCredits.toFixed(1)}</span>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-xs border border-white/15">
              <span className="text-xs text-emerald-200/80 block font-medium">{t("common.value") || "Estimated Value"}</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 mt-1 block tracking-tight">₹{totalValue.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activities */}
      <CarbonActivitiesList 
        loading={loading} 
        activities={activities}
        activityLabels={activityLabels} 
        statusColors={statusColors}
        handleMakeOffer={handleMakeOffer}
        handleAcceptOffer={handleAcceptOffer}
        handleRejectOffer={handleRejectOffer}
      />
    </div>
  );
}