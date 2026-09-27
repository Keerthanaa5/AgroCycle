import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/i18n";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { 
  TrendingUp, 
  Store, 
  MapPin, 
  Users, 
  Sparkles, 
  ArrowRight, 
  Building2, 
  Phone, 
  MessageCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  ExternalLink, 
  RefreshCw, 
  Send, 
  Package, 
  ShieldCheck, 
  Factory, 
  ShoppingCart, 
  Warehouse, 
  FileCheck, 
  HelpCircle,
  Clock,
  ChevronRight,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { getMarketPrice } from "@/services/marketPriceService";
import { findMatchingBuyers } from "@/services/buyerMatchingService";
import { calculateDemandSignal } from "@/services/demandSignalService";
import { calculateSurplus } from "@/services/surplusService";
import { 
  getAssessmentHandoff, 
  consumeAssessmentHandoff,
  setAssessmentHandoff,
  createHandoffFromAssessment 
} from "@/services/assessmentHandoffService";
import { getSavedLocation } from "@/services/locationService";
import { localDB } from "@/services/localDB";
import VerifiedBadge from "@/components/VerifiedBadge";
import { enqueueAction, ACTION_TYPES } from "@/services/syncQueue";
import { syncManager } from "@/services/syncManager";

export default function MarketIntelligence() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isOnline, isOffline } = useOnlineStatus();
  const navigate = useNavigate();

  // Primary Input States
  const [crop, setCrop] = useState("Tomato");
  const [quantity, setQuantity] = useState("500");
  const [locationText, setLocationText] = useState("Madurai, Tamil Nadu");
  const [farmerLocation, setFarmerLocation] = useState({
    latitude: 9.9252,
    longitude: 78.1198,
    city: "Madurai",
    district: "Madurai",
    state: "Tamil Nadu"
  });
  const [condition, setCondition] = useState("slightly_damaged");
  const [sourceAssessmentId, setSourceAssessmentId] = useState(null);
  const [isFromScanner, setIsFromScanner] = useState(false);
  const [rawAssessment, setRawAssessment] = useState(null);

  // Intelligence State
  const [loading, setLoading] = useState(false);
  const [priceData, setPriceData] = useState(null);
  const [matchedBuyersResult, setMatchedBuyersResult] = useState({ count: 0, buyers: [], hasGps: false });
  const [demandSignal, setDemandSignal] = useState(null);
  const [surplusResult, setSurplusResult] = useState(null);

  // Modals
  const [selectedBuyerForView, setSelectedBuyerForView] = useState(null);
  const [selectedBuyerForConnect, setSelectedBuyerForConnect] = useState(null);
  const [connectMessage, setConnectMessage] = useState("");
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);

  // Check for assessment handoff on mount
  useEffect(() => {
    const handoff = getAssessmentHandoff("market-intelligence");
    if (handoff) {
      if (handoff.crop) setCrop(handoff.crop);
      if (handoff.quantity?.value) setQuantity(String(handoff.quantity.value));
      if (handoff.readableLocation) setLocationText(handoff.readableLocation);
      if (handoff.location && typeof handoff.location === "object") {
        setFarmerLocation(handoff.location);
      }
      if (handoff.condition) setCondition(handoff.condition);
      if (handoff.assessmentId) setSourceAssessmentId(handoff.assessmentId);
      setIsFromScanner(true);
      setRawAssessment(handoff);

      // Consume handoff
      consumeAssessmentHandoff("market-intelligence");
    } else {
      // Auto-load saved GPS location if available
      const currentUserId = user?.userId || user?.id || "default_user";
      getSavedLocation(currentUserId).then((loc) => {
        if (loc && loc.latitude && loc.longitude) {
          setFarmerLocation(loc);
          if (loc.city && loc.state) {
            setLocationText(`${loc.city}, ${loc.state}`);
          }
        }
      }).catch(() => {});
    }
  }, [user]);

  // Compute market intelligence data whenever inputs change
  useEffect(() => {
    computeIntelligence();
  }, [crop, quantity, farmerLocation, locationText, condition]);

  async function computeIntelligence() {
    const trimmedCrop = (crop || "").trim();
    const qtyNumber = quantity ? Number(quantity) : null;

    if (!trimmedCrop) {
      setPriceData({
        available: false,
        empty: true,
        crop: "",
        message: "Enter a crop name to view current market prices."
      });
      setMatchedBuyersResult({
        count: 0,
        buyers: [],
        hasGps: false,
        message: "Please specify a crop to find matching registered buyers."
      });
      setDemandSignal(calculateDemandSignal({ matchedBuyers: [], availableFarmerQuantity: qtyNumber, crop: "" }));
      setSurplusResult(calculateSurplus({ availableQuantity: qtyNumber, matchedBuyers: [] }));
      setLoading(false);
      return;
    }

    if (trimmedCrop.length < 3) {
      setPriceData({
        available: false,
        tooShort: true,
        crop: trimmedCrop,
        message: "Enter a complete crop name."
      });
      setMatchedBuyersResult({
        count: 0,
        buyers: [],
        hasGps: false,
        message: "Enter a complete crop name to find matching registered buyers."
      });
      setDemandSignal(calculateDemandSignal({ matchedBuyers: [], availableFarmerQuantity: qtyNumber, crop: trimmedCrop }));
      setSurplusResult(calculateSurplus({ availableQuantity: qtyNumber, matchedBuyers: [] }));
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Fetch Current Market Price
    const priceRes = await getMarketPrice({
      crop: trimmedCrop,
      location: farmerLocation || locationText
    });
    setPriceData(priceRes);

    // 2. Run Buyer Matching Engine
    const buyersRes = findMatchingBuyers({
      crop: trimmedCrop,
      quantity: qtyNumber,
      farmerLocation: farmerLocation || locationText,
      condition
    });
    setMatchedBuyersResult(buyersRes);

    // 3. Calculate Deterministic Demand Signal
    const demandRes = calculateDemandSignal({
      matchedBuyers: buyersRes.buyers,
      availableFarmerQuantity: qtyNumber,
      crop: trimmedCrop
    });
    setDemandSignal(demandRes);

    // 4. Calculate Surplus
    const surplusRes = calculateSurplus({
      availableQuantity: qtyNumber,
      matchedBuyers: buyersRes.buyers,
      unit: "kg"
    });
    setSurplusResult(surplusRes);

    setLoading(false);
  }

  // Handle Connecting with Buyer (Send Interest Request)
  function handleOpenConnect(buyer) {
    setSelectedBuyerForConnect(buyer);
    const qtyStr = quantity ? `${quantity} kg of ` : "";
    const locStr = locationText ? ` in ${locationText}` : "";
    setConnectMessage(
      `Hello, I have ${qtyStr}${crop} available${locStr}. I noticed your procurement requirement for ${buyer.matchedRequirement?.quantityRequired} kg ${buyer.matchedRequirement?.crop} on AgroCycle. Looking forward to discussing terms.`
    );
    setInquirySuccess(false);
  }

  async function handleSendInquiry(e) {
    e.preventDefault();
    if (!selectedBuyerForConnect) return;

    setSendingInquiry(true);
    const currentUserId = user?.userId || user?.id || "anonymous_farmer";

    const inquiryRecord = {
      id: `inq_${Date.now()}`,
      farmerId: currentUserId,
      farmerName: user?.name || user?.full_name || "Farmer",
      farmerPhone: user?.phone || "N/A",
      buyerId: selectedBuyerForConnect.buyerId,
      buyerName: selectedBuyerForConnect.businessName,
      crop: crop,
      quantityKg: quantity ? Number(quantity) : null,
      location: locationText,
      message: connectMessage,
      sourceAssessmentId: sourceAssessmentId || null,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    // Save into local database
    localDB.addItem("marketInquiries", inquiryRecord);

    // Enqueue sync action
    try {
      await enqueueAction({
        userId: currentUserId,
        actionType: "SEND_BUYER_INQUIRY",
        entityType: "marketInquiry",
        entityId: inquiryRecord.id,
        payload: inquiryRecord
      });
      if (syncManager.isOnline()) {
        syncManager.processQueue(currentUserId).catch(() => {});
      }
    } catch (err) {
      console.warn("[MarketIntelligence] Sync enqueue notice:", err);
    }

    setSendingInquiry(false);
    setInquirySuccess(true);
    setTimeout(() => {
      setSelectedBuyerForConnect(null);
      setInquirySuccess(false);
    }, 1800);
  }

  // Direct Handoff to Urban Waste Matcher
  function handleLaunchWasteMarket() {
    if (rawAssessment) {
      const handoff = createHandoffFromAssessment(rawAssessment, "urban-waste-matcher");
      setAssessmentHandoff(handoff);
    }
    navigate("/waste-market");
  }

  // Direct Handoff to Silage Bank (respecting safety rules)
  function handleLaunchSilageBank() {
    navigate("/silage-bank");
  }

  // Safety context check for animal feed
  const isDiseaseDisqualifiedForFeed =
    condition === "heavily_damaged" ||
    condition === "critical" ||
    rawAssessment?.primaryDisease ||
    rawAssessment?.condition === "critical";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Layer C — Market Intelligence & Commercial Matching
            </h1>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Understand current government market price ranges, discover nearby registered commercial buyers, and detect surplus.
          </p>
        </div>

        {isOffline && (
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 self-start text-xs font-semibold px-3 py-1">
            Offline: Using Cached Market Data
          </Badge>
        )}
      </div>

      {/* Origin Banner if arrived via Viability Scanner */}
      {isFromScanner && (
        <div className="bg-primary/10 border border-primary/20 text-primary rounded-2xl p-4 flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-bold text-foreground text-sm">
                ✓ Pre-filled from On-Device Viability Assessment
              </p>
              <p className="text-muted-foreground mt-0.5">
                Assessment ID: <span className="font-mono text-foreground font-medium">{sourceAssessmentId || "Verified"}</span> • 
                Crop, harvest quantity, and location were automatically transferred.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs bg-card border-primary/30 shrink-0 font-medium">
            Verified Scan Handoff
          </Badge>
        </div>
      )}

      {/* Interactive Control & Filter Bar (Allows instant farmer review / refinement) */}
      <div className="bg-card rounded-3xl border border-border/80 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-primary" /> Active Crop Supply Parameters
          </span>
          <span className="text-[11px] text-muted-foreground">Values can be updated anytime</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Crop Name
            </label>
            <Input
              value={crop}
              onChange={(e) => {
                const val = e.target.value;
                setCrop(val);
                // Immediately reset price to prevent showing stale results from previous crop
                if (!val.trim()) {
                  setPriceData({ available: false, empty: true, message: "Enter a crop name to view current market prices." });
                } else if (val.trim().length < 3) {
                  setPriceData({ available: false, tooShort: true, message: "Enter a complete crop name." });
                } else {
                  setPriceData(null);
                }
              }}
              placeholder="e.g. Tomato, Potato, Maize"
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Available Quantity (kg)
            </label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 500 (Optional)"
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Farm / Pickup Location
            </label>
            <Input
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="e.g. Madurai, Tamil Nadu"
              className="rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* INTELLIGENCE 4-GRID DISPLAY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* ============================================================== */}
        {/* CARD 1: CURRENT MARKET PRICE                                   */}
        {/* ============================================================== */}
        <div className="bg-card rounded-3xl border border-border/80 p-6 shadow-natural flex flex-col justify-between space-y-4 relative overflow-hidden group hover:border-primary/30 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  ₹
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Current Market Price
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Government DMI / AGMARKNET Records</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] bg-secondary border-border/80">
                {priceData?.isOfflineCached ? "Government Agmarknet (Cached)" : "Government of India DMI"}
              </Badge>
            </div>

            {priceData?.available ? (
              <div className="space-y-3.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                    ₹{priceData.minPrice}–₹{priceData.maxPrice}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">/ {priceData.unit}</span>
                  {priceData.minPriceQuintal && (
                    <span className="text-xs text-muted-foreground font-medium ml-1">
                      (₹{priceData.minPriceQuintal?.toLocaleString()}–₹{priceData.maxPriceQuintal?.toLocaleString()} / Quintal)
                    </span>
                  )}
                </div>

                <div className="p-3 bg-muted/30 rounded-2xl border border-border/60 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Modal Price:</span>
                    <div className="text-right">
                      <strong className="text-primary font-bold text-sm">₹{priceData.modalPrice} / {priceData.unit}</strong>
                      {priceData.modalPriceQuintal && (
                        <span className="text-[10px] text-muted-foreground block font-normal">
                          ₹{priceData.modalPriceQuintal?.toLocaleString()} / Quintal
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Market (Mandi):</span>
                    <span className="text-foreground font-medium">
                      {priceData.market}{priceData.district && priceData.district !== priceData.market ? `, ${priceData.district}` : ""}{priceData.state ? ` (${priceData.state})` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Variety / Grade:</span>
                    <span className="text-foreground font-medium">
                      {priceData.variety || "Standard"} • Grade {priceData.grade || "FAQ"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">Arrival Date:</span>
                    <span className="text-foreground font-medium">{priceData.arrivalDate || priceData.updatedAt}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">Government Source:</span>
                    <span className="text-foreground font-medium">{priceData.source}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-muted/20 rounded-2xl border border-dashed border-border/90 text-center space-y-1 my-2">
                <HelpCircle className="h-6 w-6 text-muted-foreground mx-auto opacity-60" />
                <p className="font-semibold text-xs text-foreground">
                  {priceData?.empty
                    ? "Enter a crop name to view current market prices."
                    : priceData?.tooShort
                    ? "Enter a complete crop name."
                    : "No Government Market Record Found"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {priceData?.empty
                    ? "Please enter a crop name in the parameter bar above."
                    : priceData?.tooShort
                    ? "Crop name must be at least 3 characters."
                    : (priceData?.message || `No government market record found for "${(crop || "").trim()}" in the selected region.`)}
                </p>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground border-t border-border/50 pt-2.5 flex items-center gap-1">
            <Info className="h-3 w-3 shrink-0" />
            <span>Official wholesale mandi price reports from Directorate of Marketing & Inspection (DMI), Government of India.</span>
          </p>
        </div>

        {/* ============================================================== */}
        {/* CARD 2: DEMAND SIGNAL                                          */}
        {/* ============================================================== */}
        <div className="bg-card rounded-3xl border border-border/80 p-6 shadow-natural flex flex-col justify-between space-y-4 relative overflow-hidden group hover:border-primary/30 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Demand Signal
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Active Registered Buyer Requirements</p>
                </div>
              </div>

              {demandSignal?.badgeText && (
                <Badge className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                  demandSignal.level === "strong" ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" :
                  demandSignal.level === "moderate" ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300" :
                  demandSignal.level === "limited" ? "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {demandSignal.badgeText}
                </Badge>
              )}
            </div>

            <div className="space-y-3.5">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                  {demandSignal?.totalVisibleDemandKg ? `${demandSignal.totalVisibleDemandKg.toLocaleString()} kg` : "0 kg"}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">visible demand</span>
              </div>

              <div className="p-3.5 bg-muted/30 rounded-2xl border border-border/60 text-xs space-y-2">
                <p className="font-medium text-foreground leading-relaxed">
                  {demandSignal?.explanation}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-border/40 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block">Farmer Supply:</span>
                    <strong className="text-foreground">{quantity ? `${Number(quantity).toLocaleString()} kg` : "Unspecified"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Visible Buyer Demand:</span>
                    <strong className="text-foreground">{demandSignal?.totalVisibleDemandKg?.toLocaleString() || 0} kg</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground border-t border-border/50 pt-2.5 flex items-center gap-1">
            <Info className="h-3 w-3 shrink-0" />
            <span>Visible buyer demand is calculated deterministically from active registered buyer orders.</span>
          </p>
        </div>

        {/* ============================================================== */}
        {/* CARD 3: POTENTIAL REGISTERED BUYER MATCHES                     */}
        {/* ============================================================== */}
        <div className="bg-card rounded-3xl border border-border/80 p-6 shadow-natural space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Potential Registered Buyer Matches ({matchedBuyersResult.count})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Verified commercial buyers, food processors, and retailers seeking {crop}
                </p>
              </div>
            </div>

            {!matchedBuyersResult.hasGps && (
              <span className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Distance matching approximate (GPS not active)
              </span>
            )}
          </div>

          {matchedBuyersResult.buyers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchedBuyersResult.buyers.map((b) => (
                <div 
                  key={b.buyerId}
                  className="p-4 bg-muted/20 hover:bg-muted/40 rounded-2xl border border-border/80 transition-all flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <h4 className="font-bold text-sm text-foreground tracking-tight leading-snug">
                          {b.businessName}
                        </h4>
                        <span className="text-[11px] font-semibold text-primary">
                          {b.businessType}
                        </span>
                      </div>
                      <VerifiedBadge status={b.verificationStatus} showIconOnly />
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground mt-2">
                      <p className="flex items-center gap-1 text-foreground font-medium">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        <span>Demand: <strong>{b.matchedRequirement?.quantityRequired} kg</strong> ({b.matchedRequirement?.variety})</span>
                      </p>
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{b.location?.city || "Tamil Nadu"}</span>
                        {b.distanceKm !== null && (
                          <span className="font-semibold text-primary ml-1">({b.distanceKm} km away)</span>
                        )}
                      </p>
                      {b.matchedRequirement?.targetPrice && (
                        <p className="text-[11px] text-muted-foreground">
                          Target Buy Price: <strong className="text-foreground">₹{b.matchedRequirement.targetPrice}/kg</strong>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSelectedBuyerForView(b)}
                      className="flex-1 text-xs rounded-xl h-8"
                    >
                      View Buyer
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleOpenConnect(b)}
                      className="flex-1 text-xs rounded-xl h-8 gap-1 font-semibold"
                    >
                      <Send className="h-3 w-3" /> Connect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 bg-muted/20 rounded-2xl border border-dashed border-border/90 text-center space-y-2">
              <Store className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
              <p className="font-semibold text-sm text-foreground">No Registered Buyers Found</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                No active registered buyers in our database currently have procurement requirements matching "{crop}". You can explore alternative recovery routes below.
              </p>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* CARD 4: SURPLUS DETECTION                                      */}
        {/* ============================================================== */}
        <div className="bg-card rounded-3xl border border-border/80 p-6 shadow-natural space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Surplus Detection
                </h3>
                <p className="text-xs text-muted-foreground">Farmer supply vs matched buyer capacity</p>
              </div>
            </div>

            <Badge className={`text-xs font-semibold rounded-full ${
              surplusResult?.status === "potential-surplus" ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300" :
              surplusResult?.status === "sufficient-demand" ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" :
              "bg-muted text-muted-foreground"
            }`}>
              {surplusResult?.status === "potential-surplus" ? "Potential Surplus" :
               surplusResult?.status === "sufficient-demand" ? "Balanced Demand" : "Unspecified"}
            </Badge>
          </div>

          {surplusResult?.status === "potential-surplus" ? (
            <div className="space-y-3">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <strong className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Potential surplus: {surplusResult.potentialSurplus.toLocaleString()} kg
                  </strong>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {surplusResult.detailText}
                </p>
                <p className="text-foreground font-medium text-xs pt-1">
                  {surplusResult.recommendationHint}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-muted/30 rounded-xl border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">Available</span>
                  <strong className="text-foreground text-xs mt-0.5 block">{surplusResult.availableQuantity?.toLocaleString()} kg</strong>
                </div>
                <div className="p-2.5 bg-muted/30 rounded-xl border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">Matched Capacity</span>
                  <strong className="text-primary text-xs mt-0.5 block">{surplusResult.matchedBuyerCapacity?.toLocaleString()} kg</strong>
                </div>
                <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 block">Surplus</span>
                  <strong className="text-amber-800 dark:text-amber-300 text-xs mt-0.5 block">{surplusResult.potentialSurplus?.toLocaleString()} kg</strong>
                </div>
              </div>
            </div>
          ) : surplusResult?.status === "sufficient-demand" ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <strong className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  No Immediate Surplus Indicated
                </strong>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {surplusResult.detailText}
              </p>
            </div>
          ) : (
            <div className="p-4 bg-muted/30 rounded-2xl border border-border/60 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Quantity Not Specified</p>
              <p>Enter your available harvest quantity above to calculate buyer capacity balance.</p>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* CARD 5: AVAILABLE COMMERCIAL & RECOVERY ROUTES                 */}
        {/* ============================================================== */}
        <div className="bg-card rounded-3xl border border-border/80 p-6 shadow-natural space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Commercial & Value-Recovery Routes
                </h3>
                <p className="text-xs text-muted-foreground">Select an existing AgroCycle pathway</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Pathway 1: Sell to Matched Buyers */}
            {matchedBuyersResult.count > 0 && (
              <div className="p-3 bg-muted/30 hover:bg-muted/50 rounded-2xl border border-border/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h5 className="font-bold text-foreground">Sell Directly to Matched Buyers</h5>
                    <p className="text-[11px] text-muted-foreground">Direct off-take with local processors & retailers</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    if (matchedBuyersResult.buyers[0]) handleOpenConnect(matchedBuyersResult.buyers[0]);
                  }}
                  className="rounded-xl h-7 text-[11px] gap-1 shrink-0"
                >
                  <span>Connect</span>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Pathway 2: Urban Waste Matcher */}
            <div className="p-3 bg-muted/30 hover:bg-muted/50 rounded-2xl border border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="h-5 w-5 text-sky-600 shrink-0" />
                <div>
                  <h5 className="font-bold text-foreground">Urban Waste Matcher</h5>
                  <p className="text-[11px] text-muted-foreground">List surplus/damaged biomass for industrial off-take</p>
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={handleLaunchWasteMarket}
                className="rounded-xl h-7 text-[11px] gap-1 shrink-0"
              >
                <span>Launch</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>

            {/* Pathway 3: Silage Bank (Safety-guarded) */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
              isDiseaseDisqualifiedForFeed
                ? "bg-muted/10 border-border/40 opacity-60"
                : "bg-muted/30 hover:bg-muted/50 border-border/60"
            }`}>
              <div className="flex items-center gap-2.5">
                <Warehouse className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <h5 className="font-bold text-foreground flex items-center gap-1.5">
                    <span>Silage Bank Network</span>
                    {isDiseaseDisqualifiedForFeed && (
                      <span className="text-[9px] bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 px-1.5 py-0.2 rounded font-semibold">
                        Safety Restricted
                      </span>
                    )}
                  </h5>
                  <p className="text-[11px] text-muted-foreground">
                    {isDiseaseDisqualifiedForFeed 
                      ? "Disease detected in field assessment. Restricted from livestock feed."
                      : "Convert clean agricultural biomass into high-nutrient silage."}
                  </p>
                </div>
              </div>
              {!isDiseaseDisqualifiedForFeed && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleLaunchSilageBank}
                  className="rounded-xl h-7 text-[11px] gap-1 shrink-0"
                >
                  <span>Explore</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Pathway 4: AgroConnect Community */}
            <div className="p-3 bg-muted/30 hover:bg-muted/50 rounded-2xl border border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Users className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <h5 className="font-bold text-foreground">AgroConnect Community</h5>
                  <p className="text-[11px] text-muted-foreground">Peer-to-peer farmer exchange, local composting, or mulch sharing</p>
                </div>
              </div>
              <Button asChild size="sm" variant="ghost" className="rounded-xl h-7 text-[11px] gap-1 shrink-0">
                <Link to="/agro-connect">
                  <span>Open</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW BUYER DIALOG */}
      <Dialog open={Boolean(selectedBuyerForView)} onOpenChange={(open) => !open && setSelectedBuyerForView(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold text-foreground">
                {selectedBuyerForView?.businessName}
              </DialogTitle>
            </div>
            <p className="text-xs text-primary font-semibold mt-0.5">
              {selectedBuyerForView?.businessType} • Verified Buyer Profile
            </p>
          </DialogHeader>

          {selectedBuyerForView && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="bg-muted/30 rounded-2xl border border-border/80 divide-y divide-border/60">
                <div className="p-3 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Procurement Crop:</span>
                  <strong className="text-foreground">{selectedBuyerForView.matchedRequirement?.crop}</strong>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Quantity Requirement:</span>
                  <strong className="text-foreground">{selectedBuyerForView.matchedRequirement?.quantityRequired} {selectedBuyerForView.matchedRequirement?.unit}</strong>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Location:</span>
                  <span className="text-foreground flex items-center gap-1 font-semibold">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> {selectedBuyerForView.location?.city}, {selectedBuyerForView.location?.state}
                  </span>
                </div>
                {selectedBuyerForView.distanceKm !== null && (
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Distance from Farm:</span>
                    <strong className="text-primary font-bold">{selectedBuyerForView.distanceKm} km</strong>
                  </div>
                )}
                <div className="p-3 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Buying Radius:</span>
                  <span className="text-foreground">{selectedBuyerForView.buyingRadiusKm} km</span>
                </div>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/80 space-y-1">
                <p className="font-semibold text-foreground">Contact Person:</p>
                <p className="text-muted-foreground text-xs">{selectedBuyerForView.contactInformation?.contactPerson || "Procurement Dept"}</p>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedBuyerForView(null)} 
                  className="flex-1 rounded-2xl h-10 text-xs font-semibold"
                >
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    const b = selectedBuyerForView;
                    setSelectedBuyerForView(null);
                    handleOpenConnect(b);
                  }} 
                  className="flex-1 rounded-2xl h-10 text-xs font-semibold gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" /> Connect
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CONNECT WITH BUYER DIALOG */}
      <Dialog open={Boolean(selectedBuyerForConnect)} onOpenChange={(open) => !open && setSelectedBuyerForConnect(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              <span>Connect with {selectedBuyerForConnect?.businessName}</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and customize your supply inquiry before sending.
            </p>
          </DialogHeader>

          {selectedBuyerForConnect && (
            <form onSubmit={handleSendInquiry} className="space-y-4 pt-2 text-xs">
              <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/80 space-y-1">
                <p className="font-semibold text-foreground">
                  Target Buyer: <span className="text-primary">{selectedBuyerForConnect.businessName}</span>
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Requirement: {selectedBuyerForConnect.matchedRequirement?.quantityRequired} kg {selectedBuyerForConnect.matchedRequirement?.crop} ({selectedBuyerForConnect.businessType})
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Inquiry Message *
                </label>
                <Textarea
                  value={connectMessage}
                  onChange={(e) => setConnectMessage(e.target.value)}
                  rows={4}
                  required
                  className="rounded-2xl resize-none text-xs"
                />
              </div>

              {inquirySuccess ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 rounded-2xl flex items-center gap-2 font-semibold text-xs justify-center">
                  <CheckCircle2 className="h-4 w-4" /> Inquiry sent and saved offline!
                </div>
              ) : (
                <div className="flex gap-2">
                  {selectedBuyerForConnect.contactInformation?.phone && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const phone = selectedBuyerForConnect.contactInformation.phone.replace(/[^0-9]/g, "");
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(connectMessage)}`, "_blank");
                      }}
                      className="rounded-2xl h-11 text-xs gap-1.5 flex-1"
                    >
                      <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={sendingInquiry}
                    className="rounded-2xl h-11 text-xs gap-1.5 font-semibold flex-1"
                  >
                    {sendingInquiry ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span>Send Inquiry</span>
                  </Button>
                </div>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
