import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { 
  canCreateListing, 
  isFarmer, 
  isBuyer, 
  isRecordOwner,
  isActiveFarmer,
  isActiveBuyer,
  getListingContactPhone,
  getListingWhatsAppUrl
} from "@/services/roleManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Store, MapPin, Loader2, Upload, Trash2, MessageCircle, Phone, Building2, ShoppingCart, Leaf, Sparkles, Check, RefreshCw, Eye, Edit3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { localDB, KEYS } from "@/services/localDB";
import VerifiedBadge from "@/components/VerifiedBadge";
import SyncStatusBadge from "@/components/SyncStatusBadge";
import { enqueueAction, ACTION_TYPES } from "@/services/syncQueue";
import { syncManager } from "@/services/syncManager";
import { useLanguage } from "@/i18n";
import { getAssessmentHandoff, consumeAssessmentHandoff } from "@/services/assessmentHandoffService";

const DEFAULT_WASTE_LISTINGS = [
  {
    id: "buyer_req_default_1",
    creatorId: "usr_buyer_greenvalley",
    creatorRole: "buyer",
    creatorName: "GreenValley Foods Ltd.",
    creatorPhone: "9876543220",
    creatorVerificationStatus: "verified",
    buyerId: "usr_buyer_greenvalley",
    buyerName: "GreenValley Foods Ltd.",
    buyerPhone: "9876543220",
    buyerVerificationStatus: "verified",
    crop_type: "Damaged Wheat / Starch Grade",
    quantity_kg: 500,
    condition: "slightly_damaged",
    location: "Hyderabad Industrial Zone",
    asking_price: 12,
    status: "listed",
    listingType: "buy",
    date: new Date().toISOString()
  },
  {
    id: "buyer_req_default_2",
    creatorId: "usr_buyer_sunrise",
    creatorRole: "buyer",
    creatorName: "Sunrise Hotel Group",
    creatorPhone: "9876543221",
    creatorVerificationStatus: "verified",
    buyerId: "usr_buyer_sunrise",
    buyerName: "Sunrise Hotel Group",
    buyerPhone: "9876543221",
    buyerVerificationStatus: "verified",
    crop_type: "Bruised Tomatoes & Vegetables",
    quantity_kg: 250,
    condition: "damaged",
    location: "Warangal City Center",
    asking_price: 15,
    status: "listed",
    listingType: "buy",
    date: new Date().toISOString()
  }
];

function ViewListingDialog({ open, onOpenChange, item }) {
  const { user } = useAuth();
  const { t } = useLanguage();

  if (!item) return null;

  const isOwner = isRecordOwner(item, user);
  const isBuyerListing = item.creatorRole === "buyer" || Boolean(item.buyerPhone) || item.listingType === "buy";
  const contactPersonName = isBuyerListing 
    ? (item.buyerName || item.creatorName || "Commercial Buyer") 
    : (item.farmerName || item.creatorName || "Community Farmer");

  const getValidImageUrl = (url) => {
    if (!url || typeof url !== "string") return null;
    if (url.startsWith("blob:") || url === "[object Object]" || url === "undefined" || url === "null") return null;
    return url;
  };
  const validImage = getValidImageUrl(item.image || item.image_url);

  const formatCondition = (cond) => {
    if (!cond) return "N/A";
    const mapped = {
      slightly_damaged: t("agroConnect.conditions.slightly_damaged") || "Slightly Damaged",
      damaged: t("agroConnect.conditions.damaged") || "Damaged",
      heavily_damaged: t("scanner.severityLevels.critical") || "Heavily Damaged"
    };
    return mapped[cond] || cond.replace(/_/g, " ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-xl font-bold text-foreground">
              {item.crop_type}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
              isBuyerListing 
                ? "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800" 
                : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
            }`}>
              {isBuyerListing ? "💼 " + (t("wasteMarket.buyerDemand") || "Buyer Demand") : "🌾 " + (t("wasteMarket.forSale") || "For Sale")}
            </span>
            {isOwner && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {t("wasteMarket.myListing") || "My Listing"}
              </span>
            )}
            {item.source === "viability-scanner" && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                ⚡ From Viability Assessment
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {validImage && (
            <div className="overflow-hidden rounded-2xl border border-border/60 shadow-xs aspect-[16/9] w-full">
              <img src={validImage} alt={item.crop_type} className="w-full h-full object-cover" />
            </div>
          )}

          {item.source === "viability-scanner" && (
            <div className="bg-primary/10 border border-primary/20 text-primary rounded-2xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-bold text-foreground">Verified Viability Assessment</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Originated from on-device field assessment
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] bg-card border-primary/30 shrink-0 font-medium">
                Verified Scan
              </Badge>
            </div>
          )}

          <div className="bg-muted/30 rounded-2xl border border-border/80 divide-y divide-border/60 text-xs">
            <div className="p-3 flex justify-between items-center">
              <span className="text-muted-foreground font-medium">{t("common.quantity") || "Available Quantity"}</span>
              <span className="font-bold text-foreground">{item.quantity_kg} kg</span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Condition & Quality</span>
              <span className="font-semibold text-foreground capitalize">{formatCondition(item.condition)}</span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-muted-foreground font-medium">{t("common.location") || "Location"}</span>
              <span className="font-semibold text-foreground flex items-center gap-1 text-right">
                <MapPin className="h-3 w-3 text-primary shrink-0" /> {item.location}
              </span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-muted-foreground font-medium">{t("common.price") || "Asking Price"}</span>
              <span className="font-bold text-primary">
                {item.asking_price > 0 ? `₹${item.asking_price}/kg` : "Not specified"}
              </span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Status</span>
              <span className="capitalize font-semibold text-foreground">{item.status || "listed"}</span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-muted-foreground font-medium">{t("common.date") || "Listed Date"}</span>
              <span className="text-muted-foreground">{new Date(item.created_date || item.date || Date.now()).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/80 text-xs flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">
                {isBuyerListing ? (t("wasteMarket.buyerLabel") || "Buyer:") : (t("wasteMarket.sellerLabel") || "Farmer:")} {contactPersonName}
              </p>
              <p className="text-muted-foreground text-[11px] mt-0.5">{t("common.contact") || "Contact"}: {item.phone || item.creatorPhone || "N/A"}</p>
            </div>
            <VerifiedBadge status={item.creatorVerificationStatus || item.buyerVerificationStatus || "verified"} />
          </div>

          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full rounded-2xl py-2.5 text-xs font-semibold">
            {t("common.close") || "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PostCreationDialog({ dialogOpen, setDialogOpen, handleSubmit, form, setForm, imageFile, setImageFile, uploadingImage, scannerHandoff, isEditing }) {
  const { user, isActiveBuyer: userIsActiveBuyer } = useAuth();
  const { t } = useLanguage();
  if (!canCreateListing(user)) {
    return null;
  }

  const isBuyerMode = userIsActiveBuyer;
  const isFromScanner = Boolean(scannerHandoff || form.source === "viability-scanner");

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 rounded-xl shadow-xs">
          <Plus className="h-4 w-4" /> 
          {isBuyerMode ? (t("wasteMarket.postRequirement") || "Post Requirement") : t("wasteMarket.postListing")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span>
              {isEditing 
                ? (t("wasteMarket.editListing") || "Edit Crop Waste Listing") 
                : isBuyerMode 
                  ? (t("wasteMarket.postRequirement") || "Post Crop Purchase Requirement") 
                  : t("wasteMarket.modalTitle")}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Non-intrusive Scanner Handoff Pre-fill Indicator */}
        {isFromScanner && (
          <div className="bg-primary/10 border border-primary/20 text-primary rounded-2xl p-3 flex items-center justify-between text-xs mt-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-bold text-foreground flex items-center gap-1">
                  <span>{isEditing ? "⚡ Viability Assessment Linked" : "✓ Pre-filled from Viability Assessment"}</span>
                </p>
                <p className="text-[11px] text-muted-foreground font-normal mt-0.5 leading-tight">
                  {scannerHandoff?.crop ? `${scannerHandoff.crop} • ` : ""}
                  {scannerHandoff?.cultivatedAcres ? `${scannerHandoff.cultivatedAcres} acres • ` : ""}
                  {isEditing ? "Changes will update this marketplace listing." : "Review and complete any missing fields before publishing."}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] bg-card border-primary/30 shrink-0 font-medium">
              Verified Scan
            </Badge>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/80 text-xs flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">
                {isBuyerMode ? (t("wasteMarket.buyerLabel") || "Buyer:") : (t("wasteMarket.sellerLabel") || "Farmer:")} {user?.name || user?.full_name}
              </p>
              <p className="text-muted-foreground text-[11px] mt-0.5">{t("common.contact") || "Contact"}: {user?.phone || "N/A"}</p>
            </div>
            <VerifiedBadge status={user?.verificationStatus} />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Material / Crop Waste Name *
            </label>
            <Input 
              placeholder={isBuyerMode ? (t("wasteMarket.requiredCropPlaceholder") || "Required Crop Type (e.g. Tomato, Ragi, Corn) *") : t("wasteMarket.cropTypePlaceholder")} 
              value={form.crop_type} 
              onChange={e => setForm(f => ({ ...f, crop_type: e.target.value }))} 
              required 
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Available Quantity (kg) *
            </label>
            <Input 
              type="number" 
              placeholder={isBuyerMode ? (t("wasteMarket.requiredQuantityPlaceholder") || "Required Quantity (kg) *") : t("wasteMarket.quantityLabel")} 
              value={form.quantity_kg} 
              onChange={e => setForm(f => ({ ...f, quantity_kg: e.target.value }))} 
              required 
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Condition & Quality *
            </label>
            <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select condition" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="slightly_damaged">{t("agroConnect.conditions.slightly_damaged") || "Slightly Damaged"}</SelectItem>
                <SelectItem value="damaged">{t("agroConnect.conditions.damaged") || "Damaged"}</SelectItem>
                <SelectItem value="heavily_damaged">{t("scanner.severityLevels.critical") || "Heavily Damaged"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Farm / Pickup Location *
            </label>
            <Input 
              placeholder={isBuyerMode ? (t("wasteMarket.factoryLocationPlaceholder") || "Operating Location / Factory *") : t("wasteMarket.locationLabel")} 
              value={form.location} 
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} 
              required 
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Asking Price (₹ / kg)
            </label>
            <Input 
              type="number" 
              placeholder={isBuyerMode ? (t("wasteMarket.targetPricePlaceholder") || "Target Off-Take Price per kg (₹)") : t("wasteMarket.priceLabel")} 
              value={form.asking_price} 
              onChange={e => setForm(f => ({ ...f, asking_price: e.target.value }))} 
              className="rounded-xl"
            />
          </div>

          {!isBuyerMode && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Attach Crop Photo
                </label>
                {imageFile && isFromScanner && (
                  <span className="text-[10px] text-primary font-medium">
                    From Viability Assessment
                  </span>
                )}
              </div>

              <label className="flex flex-col items-center border-2 border-dashed border-border/90 rounded-2xl p-4 cursor-pointer hover:border-primary/50 transition-all overflow-hidden h-32 relative bg-muted/20 group">
                {imageFile ? (
                  <div className="w-full h-full relative">
                    <img src={imageFile} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                      <RefreshCw className="h-4 w-4" /> Change Photo
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Upload className="h-5 w-5 text-muted-foreground mb-1 group-hover:text-primary transition-colors" />
                    <p className="text-xs text-muted-foreground">{t("wasteMarket.uploadPhotoLabel") || "Upload Crop Leaf / Produce Photo"}</p>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setImageFile(reader.result);
                    reader.readAsDataURL(file);
                  }
                }} className="hidden" />
              </label>
            </div>
          )}

          <Button type="submit" className="w-full gap-2 rounded-2xl py-5 shadow-xs font-semibold" disabled={uploadingImage}>
            {uploadingImage ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading") || "Loading..."}</>
            ) : isEditing ? (
              t("common.saveChanges") || "Save Changes"
            ) : isBuyerMode ? (
              t("wasteMarket.publishRequirement") || "Publish Buyer Requirement"
            ) : (
              t("wasteMarket.publishListing")
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ListingsFeed({ loading, listings, handleDelete, handleView, handleEdit, statusColors }) {
  const { user, isActiveFarmer: userIsActiveFarmer } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (listings.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground bg-card rounded-3xl border border-border/80 p-8 shadow-xs">
        <Store className="h-12 w-12 mx-auto mb-3 opacity-40 text-primary" />
        <p className="font-medium text-foreground">{t("wasteMarket.emptyListings")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("wasteMarket.emptySubtitle")}</p>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {listings.map((item, i) => {
        const isOwner = isRecordOwner(item, user);
        const isBuyerListing = item.creatorRole === "buyer" || Boolean(item.buyerPhone) || item.listingType === "buy";
        const targetPhone = getListingContactPhone(item, user);
        const whatsappUrl = getListingWhatsAppUrl(item, user);

        const contactPersonName = isBuyerListing 
          ? (item.buyerName || item.creatorName || "Commercial Buyer") 
          : (item.farmerName || item.creatorName || "Community Farmer");

        return (
          <motion.div key={item.id || i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="bg-card rounded-3xl border border-border/80 p-5 shadow-natural hover:shadow-natural-lg hover:border-primary/30 transition-all relative flex flex-col justify-between group"
          >
            <div>
              {(() => {
                const getValidImageUrl = (url) => {
                  if (!url || typeof url !== "string") return null;
                  if (url.startsWith("blob:") || url === "[object Object]" || url === "undefined" || url === "null") return null;
                  return url;
                };
                const validImage = getValidImageUrl(item.image || item.image_url);
                return validImage ? (
                  <div className="overflow-hidden rounded-2xl mb-3.5 border border-border/60 shadow-xs aspect-[16/9]">
                    <img src={validImage} alt={item.crop_type} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                  </div>
                ) : null;
              })()}

              <div className="flex justify-between items-start mb-2.5">
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-foreground tracking-tight">{item.crop_type}</h3>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      isBuyerListing 
                        ? "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800" 
                        : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    }`}>
                      {isBuyerListing ? "💼 " + (t("wasteMarket.buyerDemand") || "Buyer Demand") : "🌾 " + (t("wasteMarket.forSale") || "For Sale")}
                    </span>

                    {item.source === "viability-scanner" && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        ⚡ From Viability Assessment
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5 items-center flex-wrap justify-end">
                  {isOwner && (
                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {t("wasteMarket.myListing") || "My Listing"}
                    </span>
                  )}
                  <SyncStatusBadge 
                    status={item.sync_status} 
                    onRetry={() => {
                      if (user?.userId) {
                        syncManager.processQueue(user.userId).catch(() => {});
                      }
                    }}
                  />
                  <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${statusColors[item.status] || "bg-muted text-muted-foreground"}`}>
                    {item.status}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                <p className="flex items-center gap-1.5 text-foreground font-medium">
                  <span>📦 {item.quantity_kg} kg</span>
                  <span>•</span>
                  <span className="capitalize">{item.condition?.replace("_", " ")}</span>
                </p>
                <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" /> {item.location}</p>
                {item.asking_price > 0 && (
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 font-bold text-primary bg-primary/10 px-3 py-1 rounded-full text-sm border border-primary/15">
                      ₹{String(item.asking_price).replace("₹", "").trim()}/kg
                      {isBuyerListing && <span className="text-[11px] text-muted-foreground font-normal ml-0.5">({t("wasteMarket.offtake") || "Off-take"})</span>}
                    </span>
                  </div>
                )}

                <div className="pt-2.5 border-t border-border/60 mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    {isBuyerListing ? <Building2 className="h-3.5 w-3.5 text-sky-700" /> : null}
                    <span>{isBuyerListing ? (t("wasteMarket.buyerLabel") || "Buyer:") : (t("wasteMarket.sellerLabel") || "Farmer:")}</span>
                    <strong className="text-foreground font-semibold">{contactPersonName}</strong>
                  </span>
                  {item.creatorId ? (
                    <VerifiedBadge status={item.creatorVerificationStatus || item.buyerVerificationStatus || "pending"} />
                  ) : (
                    <span className="text-muted-foreground text-[10px] italic">{t("wasteMarket.verifiedPartner") || "Verified Partner"}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-2">
              {/* Contact Actions for non-owners */}
              {!isOwner && targetPhone && (
                <div className="flex gap-2">
                  {whatsappUrl && (
                    <Button 
                      onClick={() => window.open(whatsappUrl, "_blank")} 
                      size="sm" 
                      className="flex-1 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> 
                      {isBuyerListing ? (t("wasteMarket.whatsappBuyer") || "WhatsApp Buyer") : (t("wasteMarket.whatsappSeller") || "WhatsApp Seller")}
                    </Button>
                  )}
                  <Button 
                    onClick={() => window.open(`tel:${targetPhone}`)} 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 gap-1.5 text-xs rounded-xl border-border/80 hover:bg-muted"
                  >
                    <Phone className="h-3.5 w-3.5" /> {t("wasteMarket.callFarmer") || "Call"}
                  </Button>
                </div>
              )}

              {/* Owner Actions: View, Edit & Remove */}
              {isOwner && (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleView(item)} 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1.5 text-xs rounded-xl border-border/80 hover:bg-muted font-medium"
                    >
                      <Eye className="h-3.5 w-3.5" /> {t("common.view") || "View"}
                    </Button>
                    <Button 
                      onClick={() => handleEdit(item)} 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1.5 text-xs rounded-xl border-border/80 hover:bg-muted font-medium"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> {t("common.edit") || "Edit"}
                    </Button>
                  </div>
                  <Button 
                    onClick={() => handleDelete(item.id)} 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-destructive hover:bg-destructive/10 gap-1.5 text-xs rounded-xl"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t("wasteMarket.deleteListing") || "Remove Listing"}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function WasteMarket() {
  const { user, isActiveBuyer: userIsActiveBuyer } = useAuth();
  const { t } = useLanguage();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingListingId, setEditingListingId] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [scannerHandoff, setScannerHandoff] = useState(null);
  const [form, setForm] = useState({
    crop_type: "", quantity_kg: "", condition: "slightly_damaged",
    location: "", asking_price: "", sourceAssessmentId: null, source: null
  });

  // Check for automated assessment handoff on mount
  useEffect(() => {
    const handoff = getAssessmentHandoff("urban-waste-matcher");
    if (handoff) {
      setForm({
        crop_type: handoff.crop || "",
        quantity_kg: handoff.quantity?.value ? String(handoff.quantity.value) : "",
        condition: handoff.mappedCondition || "slightly_damaged",
        location: handoff.readableLocation || "",
        asking_price: handoff.askingPrice ? String(handoff.askingPrice) : "",
        sourceAssessmentId: handoff.assessmentId || null,
        source: "viability-scanner"
      });

      if (handoff.selectedImage) {
        setImageFile(handoff.selectedImage);
      }

      setScannerHandoff(handoff);
      setEditingListingId(null);
      setDialogOpen(true);

      // Consume handoff so subsequent manual clicks get a clean slate
      consumeAssessmentHandoff("urban-waste-matcher");
    }
  }, []);

  useEffect(() => { 
    loadListings(); 
    const unsub = syncManager.subscribe((event) => {
      if (event.type === "ACTION_SYNCED" || event.type === "SYNC_COMPLETE") {
        loadListings();
      }
    });
    return () => unsub();
  }, [user]);

  async function loadListings() {
    setLoading(true);
    let existing = [];
    try {
      existing = await localDB.async.getData(KEYS.WASTE);
    } catch (e) {
      existing = localDB.getData(KEYS.WASTE);
    }

    if (!existing || existing.length === 0) {
      existing = DEFAULT_WASTE_LISTINGS;
      localDB.saveData(KEYS.WASTE, existing);
    }

    let data = existing.map(p => ({
      id: p.id,
      creatorId: p.creatorId || null,
      creatorRole: p.creatorRole || (p.listingType === "buy" ? "buyer" : "farmer"),
      creatorName: p.creatorName || p.user || p.farmer_name || p.buyerName || "User",
      creatorPhone: p.creatorPhone || p.phone || p.buyerPhone || p.farmerPhone,
      creatorVerificationStatus: p.creatorVerificationStatus || p.buyerVerificationStatus || null,
      
      buyerId: p.buyerId || (p.creatorRole === "buyer" ? p.creatorId : null),
      buyerName: p.buyerName || (p.creatorRole === "buyer" ? p.creatorName : null),
      buyerPhone: p.buyerPhone || (p.creatorRole === "buyer" ? p.creatorPhone || p.phone : null),
      buyerVerificationStatus: p.buyerVerificationStatus || (p.creatorRole === "buyer" ? p.creatorVerificationStatus : null),

      farmerName: p.farmerName || (p.creatorRole === "farmer" ? p.creatorName : null),
      farmerPhone: p.farmerPhone || (p.creatorRole === "farmer" ? p.creatorPhone || p.phone : null),

      crop_type: p.crop || p.crop_type,
      condition: p.condition,
      location: p.location,
      created_date: p.date,
      quantity_kg: p.quantity_kg || p.quantity || 100,
      asking_price: p.asking_price || p.price || 0,
      image: p.image || p.image_url || null,
      status: p.status || "listed",
      sync_status: p.sync_status || null,
      listingType: p.listingType || (p.creatorRole === "buyer" ? "buy" : "sell"),
      phone: p.creatorPhone || p.buyerPhone || p.farmerPhone || p.phone || p.contact_phone,
      sourceAssessmentId: p.sourceAssessmentId || null,
      source: p.source || null
    }));

    setListings(data);
    setLoading(false);
  }

  function handleView(item) {
    setViewingItem(item);
    setViewDialogOpen(true);
  }

  function handleEdit(item) {
    setEditingListingId(item.id);
    setForm({
      crop_type: item.crop_type || item.crop || "",
      quantity_kg: item.quantity_kg !== undefined ? String(item.quantity_kg) : "",
      condition: item.condition || "slightly_damaged",
      location: item.location || "",
      asking_price: item.asking_price !== undefined && item.asking_price > 0 ? String(item.asking_price) : "",
      sourceAssessmentId: item.sourceAssessmentId || null,
      source: item.source || null
    });
    setImageFile(item.image || item.image_url || null);
    setScannerHandoff(item.source === "viability-scanner" ? { crop: item.crop_type, assessmentId: item.sourceAssessmentId } : null);
    setDialogOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canCreateListing(user)) {
      alert("Only registered Farmers and Buyers can create listings.");
      return null;
    }

    setUploadingImage(true);
    let base64String = typeof imageFile === "string" ? imageFile : "";
    setUploadingImage(false);

    const isBuyerMode = userIsActiveBuyer;
    const currentUserId = user.userId || user.id;

    if (editingListingId) {
      // Edit existing listing without creating a duplicate
      const existingListing = listings.find(l => l.id === editingListingId);
      const updatedPost = {
        ...(existingListing || {}),
        id: editingListingId,
        crop: form.crop_type,
        crop_type: form.crop_type,
        quantity: Number(form.quantity_kg),
        quantity_kg: Number(form.quantity_kg),
        condition: form.condition,
        location: form.location,
        price: Number(form.asking_price) || 0,
        asking_price: Number(form.asking_price) || 0,
        image: base64String || existingListing?.image || "",
        sourceAssessmentId: form.sourceAssessmentId !== undefined ? form.sourceAssessmentId : (existingListing?.sourceAssessmentId || null),
        source: form.source || existingListing?.source || (existingListing?.sourceAssessmentId ? "viability-scanner" : "manual"),
        updated_at: new Date().toISOString()
      };

      localDB.updateItem(KEYS.WASTE, editingListingId, updatedPost);

      enqueueAction({
        userId: currentUserId,
        actionType: ACTION_TYPES.UPDATE_MARKETPLACE_LISTING,
        entityType: "marketplaceListing",
        entityId: editingListingId,
        payload: updatedPost
      }).then(() => {
        if (syncManager.isOnline()) {
          syncManager.processQueue(currentUserId).catch(() => {});
        }
      }).catch(err => console.warn("[WasteMarket] Enqueue sync error:", err));

      setDialogOpen(false);
      setEditingListingId(null);
      setImageFile(null);
      setScannerHandoff(null);
      setForm({ crop_type: "", quantity_kg: "", condition: "slightly_damaged", location: "", asking_price: "", sourceAssessmentId: null, source: null });
      loadListings();
      return;
    }

    const newPost = {
      id: Date.now().toString(),
      creatorId: currentUserId,
      creatorRole: isBuyerMode ? "buyer" : "farmer",
      creatorName: user.name || user.full_name,
      creatorPhone: user.phone,
      creatorVerificationStatus: user.verificationStatus || "pending",
      
      listingType: isBuyerMode ? "buy" : "sell",
      buyerId: isBuyerMode ? currentUserId : null,
      buyerName: isBuyerMode ? (user.name || user.full_name) : null,
      buyerPhone: isBuyerMode ? user.phone : null,
      buyerVerificationStatus: isBuyerMode ? (user.verificationStatus || "pending") : null,

      farmerId: !isBuyerMode ? currentUserId : null,
      farmerName: !isBuyerMode ? (user.name || user.full_name) : null,
      farmerPhone: !isBuyerMode ? user.phone : null,

      crop: form.crop_type,
      crop_type: form.crop_type,
      quantity: Number(form.quantity_kg),
      quantity_kg: Number(form.quantity_kg),
      condition: form.condition,
      location: form.location,
      price: Number(form.asking_price) || 0,
      asking_price: Number(form.asking_price) || 0,
      
      phone: user.phone,
      date: new Date().toISOString(),
      image: base64String,
      status: "listed",
      sync_status: "pending",
      sourceAssessmentId: form.sourceAssessmentId || null,
      source: form.source || "manual"
    };

    localDB.addItem(KEYS.WASTE, newPost);

    enqueueAction({
      userId: currentUserId,
      actionType: ACTION_TYPES.CREATE_MARKETPLACE_LISTING,
      entityType: "marketplaceListing",
      entityId: newPost.id,
      payload: newPost
    }).then(() => {
      if (syncManager.isOnline()) {
        syncManager.processQueue(currentUserId).catch(() => {});
      }
    }).catch(err => console.warn("[WasteMarket] Enqueue sync error:", err));

    setDialogOpen(false);
    setEditingListingId(null);
    setImageFile(null);
    setScannerHandoff(null);
    setForm({ crop_type: "", quantity_kg: "", condition: "slightly_damaged", location: "", asking_price: "", sourceAssessmentId: null, source: null });
    loadListings();
  }

  function handleDialogOpenChange(open) {
    setDialogOpen(open);
    if (!open) {
      setEditingListingId(null);
      setScannerHandoff(null);
      setForm({ crop_type: "", quantity_kg: "", condition: "slightly_damaged", location: "", asking_price: "", sourceAssessmentId: null, source: null });
      setImageFile(null);
    }
  }

  function handleDelete(id) {
    const item = listings.find(l => l.id === id);
    if (!isRecordOwner(item, user)) {
      alert("You can only remove listings that you created.");
      return;
    }
    if (confirm("Are you sure you want to remove this listing?")) {
      localDB.deleteItem(KEYS.WASTE, id);
      loadListings();
    }
  }

  const statusColors = {
    listed: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    matched: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    sold: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{t("wasteMarket.title")}</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {userIsActiveBuyer 
              ? (t("wasteMarket.buyerSubtitle") || "Post off-take requirements and connect directly with verified local farmers") 
              : (t("wasteMarket.subtitle") || "Sell damaged crops directly to verified commercial buyers, food processors & hotels")}
          </p>
        </div>

        <PostCreationDialog
          dialogOpen={dialogOpen} setDialogOpen={handleDialogOpenChange}
          handleSubmit={handleSubmit} form={form} setForm={setForm}
          imageFile={imageFile} setImageFile={setImageFile} uploadingImage={uploadingImage}
          scannerHandoff={scannerHandoff} isEditing={Boolean(editingListingId)}
        />
      </div>

      <ListingsFeed
        loading={loading} listings={listings}
        handleDelete={handleDelete} handleView={handleView} handleEdit={handleEdit}
        statusColors={statusColors}
      />

      <ViewListingDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        item={viewingItem}
      />
    </div>
  );
}