import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Bot, 
  Sparkles, 
  Layers, 
  MapPin, 
  SlidersHorizontal, 
  CheckCircle2, 
  Plus, 
  RotateCcw, 
  FileText, 
  Calendar, 
  ShieldCheck, 
  Info, 
  Building2, 
  RefreshCw, 
  Search, 
  Filter, 
  Eye,
  DollarSign,
  AlertCircle,
  Clock,
  ArrowRight,
  CheckCheck,
  X,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import SmartMatchMap from "./SmartMatchMap";
import SmartMatchRecommendation from "./SmartMatchRecommendation";
import SupplierSelector from "./SupplierSelector";
import ProcurementOrderModal from "./ProcurementOrderModal";
import { 
  findSmartSupplyCombinations, 
  createProcurementOrder, 
  getProcurementOrders,
  fetchProcurementOrders,
  updateProcurementOrderStatus,
  ORDER_STATUS,
  MATCH_TYPES,
  FRESH_PRODUCE_CATALOG,
  mapMarketplaceListingToSupplierLot,
  BUYER_TYPES,
  BUYER_TYPE_OPTIONS,
  INTENDED_USES,
  INTENDED_USE_OPTIONS,
  MARKET_INTELLIGENCE_GRADES,
  MARKET_INTELLIGENCE_GRADE_OPTIONS,
  normalizeMarketIntelligenceGrade
} from "@/services/smartMatchService";
import { marketplaceService } from "@/services/marketplaceService";
import { realtimeSocketClient } from "@/services/realtimeSocketClient";
import { useAuth } from "@/lib/AuthContext";

/**
 * Reusable Smart Multi-Farmer Matching Workspace
 *
 * Implements Buyer-Side Fresh Produce Procurement with complete Lifecycle & Partial Sourcing:
 * Buyer Requirement -> Find Eligible Farmers -> Multi-Farmer Aggregation -> Economics -> Recommendation -> Accept / Customize -> Procurement Order
 * Lifecycle: REQUESTED -> PARTIALLY_SOURCED (with Continue Sourcing) -> FULLY_SOURCED / PARTIALLY_FULFILLED / CLOSED
 */
export default function SmartMatchingWorkspace({
  matchType = MATCH_TYPES.MARKET,
  initialCrop = "Tomato",
  initialCategory = "Vegetable",
  initialQuantityKg = 1000,
  initialQualityGrade = "Grade A — Fresh / Premium",
  initialMaxPricePerKg = 32,
  initialDestination = null,
  buyerInfo = null,
  title = "CREATE PROCUREMENT REQUIREMENT",
  subtitle = "What do you need? Aggregate fresh produce from multiple farmers to fulfill buyer demand.",
  className = ""
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Buyer Requirement Form State
  const [buyerType, setBuyerType] = useState(BUYER_TYPES.SUPERMARKET_RETAILER);
  const [intendedUse, setIntendedUse] = useState(INTENDED_USES.FRESH_RETAIL);
  const [crop, setCrop] = useState(initialCrop);
  const [category, setCategory] = useState(initialCategory); // "Vegetable" | "Fruit"
  const [quantityKg, setQuantityKg] = useState(String(initialQuantityKg));
  const [unit, setUnit] = useState("kg");
  const [qualityGrade, setQualityGrade] = useState(initialQualityGrade);
  const [maxPricePerKg, setMaxPricePerKg] = useState(String(initialMaxPricePerKg));
  const [destinationCity, setDestinationCity] = useState(initialDestination?.city || "Madurai");
  const [requiredDate, setRequiredDate] = useState(
    new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0]
  );

  // Active continuous sourcing requirement (if continuing a partially sourced order)
  const [activeSourcingOrder, setActiveSourcingOrder] = useState(null);

  // Destination coordinates
  const destinationLocation = useMemo(() => {
    if (initialDestination && initialDestination.city && initialDestination.city.toLowerCase() === destinationCity.trim().toLowerCase()) {
      return initialDestination;
    }
    const lowerCity = (destinationCity || "").toLowerCase().trim();
    let lat = 9.9252;
    let lon = 78.1198;
    if (lowerCity.includes("chennai")) {
      lat = 13.0827;
      lon = 80.2707;
    } else if (lowerCity.includes("coimbatore")) {
      lat = 11.0168;
      lon = 76.9558;
    } else if (lowerCity.includes("salem")) {
      lat = 11.6643;
      lon = 78.1460;
    } else if (lowerCity.includes("trichy") || lowerCity.includes("tiruchirappalli")) {
      lat = 10.7905;
      lon = 78.7047;
    }
    return {
      address: `${destinationCity} Food Logistics Hub`,
      city: destinationCity,
      state: "Tamil Nadu",
      latitude: lat,
      longitude: lon
    };
  }, [destinationCity, initialDestination]);

  // Mode: "RECOMMENDATION" | "CUSTOMIZE"
  const [viewMode, setViewMode] = useState("RECOMMENDATION");
  const [selectedComboIndex, setSelectedComboIndex] = useState(0);

  // Results State
  const [matchingResult, setMatchingResult] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Procurement Order Modal State
  const [createdOrder, setCreatedOrder] = useState(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Load orders from backend PostgreSQL and sync with localDB
  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const orders = await fetchProcurementOrders({ match_type: matchType });
      const filtered = (orders || []).filter(o => o.matchType === matchType);
      setRecentOrders(filtered);
    } catch (e) {
      const local = getProcurementOrders().filter(o => o.matchType === matchType);
      setRecentOrders(local);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [matchType]);

  // Reference to current demand for real-time socket events
  const currentDemandRef = useRef();
  currentDemandRef.current = {
    buyerType,
    intendedUse,
    crop,
    category,
    quantityKg,
    qualityGrade,
    maxPricePerKg,
    requiredDate,
    destinationLocation,
    destinationCity,
    buyerInfo,
    user,
    matchType,
    activeSourcingOrder
  };

  // Run matching engine with REAL PostgreSQL farmer listings
  const runMatching = async () => {
    setIsCalculating(true);
    try {
      const state = currentDemandRef.current;
      const targetCrop = (state.crop || "").trim();
      const targetCategory = state.category || "Vegetable";
      const parsedKg = Number(state.quantityKg) || 1000;
      const parsedTonnes = Number((parsedKg / 1000).toFixed(2));
      const parsedMaxPrice = state.maxPricePerKg ? Number(state.maxPricePerKg) : null;

      // 1. Fetch real active farmer listings from PostgreSQL via marketplaceService
      const { listings = [] } = await marketplaceService.fetchListings({
        status: "listed"
      });

      // 2. Filter & map real listings to standardized supplier lots (Grade A/B/C, real coords or null)
      const realFarmerLots = (listings || [])
        .filter((item) => item && item.status === "listed" && item.listingType !== "buy")
        .map(mapMarketplaceListingToSupplierLot)
        .filter((lot) => lot && lot.availableQuantityKg > 0);

      const demandObj = {
        buyerType: state.buyerType || "Food Processor",
        intendedUse: state.intendedUse || "Processing",
        crop: targetCrop,
        category: targetCategory,
        quantityKg: parsedKg,
        quantityTonnes: parsedTonnes,
        unit: "kg",
        qualityGrade: state.qualityGrade,
        maxPricePerKg: parsedMaxPrice,
        requiredDate: state.requiredDate,
        destinationLocation: state.destinationLocation,
        buyerName: state.buyerInfo?.businessName || state.user?.name || `${state.destinationCity} Food Aggregators Ltd.`,
        buyerId: state.buyerInfo?.buyerId || state.user?.userId || state.user?.id || "usr_buyer_commercial",
        requestedQuantityKg: state.activeSourcingOrder?.demand?.requestedQuantityKg || parsedKg
      };

      // 3. Feed REAL farmer listings into matching engine.
      const result = findSmartSupplyCombinations({
        demand: demandObj,
        matchType: state.matchType || MATCH_TYPES.MARKET,
        supplyListings: realFarmerLots
      });

      setMatchingResult(result);
      setSelectedComboIndex(0);
    } catch (err) {
      console.error("[SmartMatchingWorkspace] Failed to fetch supply listings or execute matching:", err);
    } finally {
      setIsCalculating(false);
    }
  };

  // Run on mount & subscribe to real-time Socket.IO marketplace & procurement events
  useEffect(() => {
    runMatching();

    const unsubCreated = realtimeSocketClient.on("listing:created", (data) => {
      console.log("[SmartMatchingWorkspace] Real-time event: listing:created", data);
      runMatching();
    });

    const unsubUpdated = realtimeSocketClient.on("listing:updated", (data) => {
      console.log("[SmartMatchingWorkspace] Real-time event: listing:updated", data);
      runMatching();
    });

    const unsubDeleted = realtimeSocketClient.on("listing:deleted", (data) => {
      console.log("[SmartMatchingWorkspace] Real-time event: listing:deleted", data);
      runMatching();
    });

    const unsubOrderCreated = realtimeSocketClient.on("procurement:order_created", () => {
      loadOrders();
    });

    const unsubOrderUpdated = realtimeSocketClient.on("procurement:order_updated", () => {
      loadOrders();
    });

    return () => {
      if (typeof unsubCreated === "function") unsubCreated();
      if (typeof unsubUpdated === "function") unsubUpdated();
      if (typeof unsubDeleted === "function") unsubDeleted();
      if (typeof unsubOrderCreated === "function") unsubOrderCreated();
      if (typeof unsubOrderUpdated === "function") unsubOrderUpdated();
    };
  }, []);

  const activeCombo = matchingResult?.combinations?.[selectedComboIndex] || matchingResult?.combinations?.[0] || null;

  // Handle Accept Recommendation
  const handleAcceptRecommendation = async (combo) => {
    if (!combo) return;
    try {
      const orderPayload = {
        orderId: activeSourcingOrder?.orderId || undefined,
        id: activeSourcingOrder?.id || activeSourcingOrder?.orderId || undefined,
        demand: {
          ...matchingResult.demand,
          requestedQuantityKg: activeSourcingOrder?.demand?.requestedQuantityKg || Number(activeSourcingOrder?.summary?.requestedQuantityKg) || matchingResult.demand.quantityKg
        },
        allocations: combo.allocations,
        matchType,
        orderType: "ACCEPTED_RECOMMENDATION",
        buyerInfo: {
          buyerId: user?.userId || user?.id || "usr_buyer_commercial",
          businessName: buyerInfo?.businessName || user?.name || "ABC Foods",
          phone: user?.phone || "9876543210",
          location: destinationLocation
        },
        notes: activeSourcingOrder 
          ? `Continuous sourcing update for requirement ${activeSourcingOrder.orderId}.` 
          : `Order confirmed by accepting AgroCycle Smart Recommendation (${combo.archetypeName}).`
      };

      const order = await createProcurementOrder(orderPayload, user);

      if (order?.error) {
        alert(`Procurement Confirmation Note: ${order.error}`);
        runMatching();
        return;
      }

      setCreatedOrder(order);
      setOrderModalOpen(true);
      setActiveSourcingOrder(null);
      await loadOrders();
      runMatching();
    } catch (err) {
      console.error("Procurement confirmation error:", err);
      alert(err.message || "Failed to confirm procurement order.");
    }
  };

  // Handle Confirm Custom Selection
  const handleConfirmCustom = async (customAllocations) => {
    if (!customAllocations || customAllocations.length === 0) return;
    try {
      const orderPayload = {
        orderId: activeSourcingOrder?.orderId || undefined,
        id: activeSourcingOrder?.id || activeSourcingOrder?.orderId || undefined,
        demand: {
          ...matchingResult.demand,
          requestedQuantityKg: activeSourcingOrder?.demand?.requestedQuantityKg || Number(activeSourcingOrder?.summary?.requestedQuantityKg) || matchingResult.demand.quantityKg
        },
        allocations: customAllocations,
        matchType,
        orderType: "CUSTOM_SELECTION",
        buyerInfo: {
          buyerId: user?.userId || user?.id || "usr_buyer_commercial",
          businessName: buyerInfo?.businessName || user?.name || "ABC Foods",
          phone: user?.phone || "9876543210",
          location: destinationLocation
        },
        notes: activeSourcingOrder
          ? `Continuous sourcing manual selection for requirement ${activeSourcingOrder.orderId}.`
          : `Order confirmed via Buyer Manual Customization (${customAllocations.length} farmers selected).`
      };

      const order = await createProcurementOrder(orderPayload, user);

      if (order?.error) {
        alert(`Procurement Confirmation Note: ${order.error}`);
        runMatching();
        return;
      }

      setCreatedOrder(order);
      setOrderModalOpen(true);
      setActiveSourcingOrder(null);
      setViewMode("RECOMMENDATION");
      await loadOrders();
      runMatching();
    } catch (err) {
      console.error("Procurement confirmation error:", err);
      alert(err.message || "Failed to confirm procurement order.");
    }
  };

  // Continue sourcing on a partially sourced order
  const handleStartContinueSourcing = (order) => {
    setActiveSourcingOrder(order);
    if (order.demand?.buyerType) setBuyerType(order.demand.buyerType);
    if (order.demand?.intendedUse) setIntendedUse(order.demand.intendedUse);
    setCrop(order.demand?.crop || "Tomato");
    setCategory(order.demand?.category || "Vegetable");
    const requested = Number(order.demand?.requestedQuantityKg || order.summary?.requestedQuantityKg || 100);
    const sourced = Number(order.summary?.sourcedQuantityKg !== undefined ? order.summary.sourcedQuantityKg : (order.summary?.totalQuantityKg || 0));
    const remaining = order.summary?.remainingQuantityKg !== undefined ? Number(order.summary.remainingQuantityKg) : Math.max(0, requested - sourced);
    
    setQuantityKg(String(remaining > 0 ? remaining : 50));
    if (order.demand?.qualityGrade) setQualityGrade(order.demand.qualityGrade);
    if (order.demand?.maxPricePerKg) setMaxPricePerKg(String(order.demand.maxPricePerKg));
    if (order.demand?.requiredDate) setRequiredDate(order.demand.requiredDate);
    if (order.demand?.destinationLocation?.city) setDestinationCity(order.demand.destinationLocation.city);

    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => runMatching(), 100);
  };

  const handleCancelContinueSourcing = () => {
    setActiveSourcingOrder(null);
  };

  // Handle buyer decision: Proceed with partially sourced quantity
  const handleProceedWithPartial = async (order) => {
    const sourcedKg = order.summary?.sourcedQuantityKg || order.summary?.totalQuantityKg || 0;
    try {
      await updateProcurementOrderStatus(
        order.orderId || order.id,
        ORDER_STATUS.PARTIALLY_FULFILLED,
        `Buyer proceeded with ${sourcedKg} kg sourced quantity. Sourcing requirement closed.`
      );
      await loadOrders();
      if (createdOrder && (createdOrder.orderId === order.orderId || createdOrder.id === order.id)) {
        setCreatedOrder(prev => ({
          ...prev,
          status: ORDER_STATUS.PARTIALLY_FULFILLED,
          summary: { ...prev.summary, remainingQuantityKg: 0 }
        }));
      }
    } catch (err) {
      console.error("Failed to proceed with partial quantity:", err);
    }
  };

  // Handle buyer decision: Close requirement
  const handleCloseRequirement = async (order) => {
    try {
      await updateProcurementOrderStatus(
        order.orderId || order.id,
        ORDER_STATUS.CLOSED,
        "Procurement requirement closed by buyer."
      );
      await loadOrders();
      if (createdOrder && (createdOrder.orderId === order.orderId || createdOrder.id === order.id)) {
        setCreatedOrder(prev => ({ ...prev, status: ORDER_STATUS.CLOSED }));
      }
    } catch (err) {
      console.error("Failed to close requirement:", err);
    }
  };

  // Handle buyer decision: Extend Required By date
  const handleExtendRequiredDate = async (order, newDate) => {
    if (!newDate) return;
    try {
      await updateProcurementOrderStatus(
        order.orderId || order.id,
        ORDER_STATUS.PARTIALLY_SOURCED,
        `Buyer extended required-by fulfillment date to ${newDate}`,
        newDate
      );
      await loadOrders();
    } catch (err) {
      console.error("Failed to extend required date:", err);
    }
  };

  // Helper for Status Badge Rendering
  const renderStatusBadge = (status, paymentStatus) => {
    const isPaid = paymentStatus === "PAID_SIMULATED";
    const st = (status || "").toUpperCase();

    if (isPaid) {
      return (
        <Badge className="bg-cyan-600 text-white font-bold text-[10px] gap-1">
          <CreditCard className="h-3 w-3" />
          PAID (SIMULATED)
        </Badge>
      );
    }
    if (st === "PARTIALLY_SOURCED") {
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold text-[10px] gap-1">
          <Clock className="h-3 w-3" />
          PARTIALLY SOURCED
        </Badge>
      );
    }
    if (st === "FULLY_SOURCED" || st === "CONFIRMED") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold text-[10px] gap-1">
          <CheckCheck className="h-3 w-3" />
          {st === "FULLY_SOURCED" ? "FULLY SOURCED" : "CONFIRMED"}
        </Badge>
      );
    }
    if (st === "PARTIALLY_FULFILLED") {
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-bold text-[10px] gap-1">
          <CheckCircle2 className="h-3 w-3" />
          PARTIALLY FULFILLED
        </Badge>
      );
    }
    if (st === "CLOSED") {
      return (
        <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 font-bold text-[10px]">
          CLOSED
        </Badge>
      );
    }
    return (
      <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 font-bold text-[10px]">
        {st || "REQUESTED"}
      </Badge>
    );
  };

  // Helper to check if deadline has reached
  const isRequiredByReached = (orderDate) => {
    if (!orderDate) return false;
    const today = new Date().toISOString().split("T")[0];
    return orderDate < today;
  };

  // Produce options helper based on selected category
  const produceSuggestions = category === "Fruit" 
    ? FRESH_PRODUCE_CATALOG.fruits 
    : FRESH_PRODUCE_CATALOG.vegetables;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Active Continuous Sourcing Mode Banner */}
      {activeSourcingOrder && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-foreground">
                Continuing Sourcing for Order <span className="font-mono text-primary">{activeSourcingOrder.orderId}</span>
              </p>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                {activeSourcingOrder.summary?.sourcedQuantityKg || activeSourcingOrder.summary?.totalQuantityKg || 0} / {activeSourcingOrder.demand?.requestedQuantityKg || activeSourcingOrder.summary?.requestedQuantityKg} kg sourced • <strong className="text-amber-700 dark:text-amber-300">{activeSourcingOrder.summary?.remainingQuantityKg || 0} kg remaining to match</strong>
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCancelContinueSourcing}
            className="rounded-xl text-xs gap-1 border-amber-500/30 hover:bg-amber-500/10 h-8"
          >
            <X className="h-3.5 w-3.5" />
            <span>Cancel / Start New Demand</span>
          </Button>
        </motion.div>
      )}

      {/* Engine Header & Buyer Requirement Form */}
      <div className="bg-gradient-to-r from-primary/10 via-background to-muted/40 p-6 rounded-3xl border border-border/80 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge className="bg-primary text-primary-foreground text-xs font-bold gap-1 px-2.5">
                <Bot className="h-3.5 w-3.5" />
                Multi-Farmer Matching Engine
              </Badge>
              <Badge variant="outline" className="border-primary/30 text-primary font-semibold text-xs">
                Fresh Produce Procurement
              </Badge>
              <span className="text-[11px] text-muted-foreground">Commercial Food Buyers & Retail Chains</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground uppercase">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setViewMode("RECOMMENDATION")}
              variant={viewMode === "RECOMMENDATION" ? "default" : "outline"}
              className="rounded-xl text-xs font-semibold h-9 shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Smart Recommendation
            </Button>
            <Button
              onClick={() => setViewMode("CUSTOMIZE")}
              variant={viewMode === "CUSTOMIZE" ? "default" : "outline"}
              className="rounded-xl text-xs font-semibold h-9 shadow-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
              Customize
            </Button>
          </div>
        </div>

        {/* Clean Buyer Requirement Form */}
        <div className="pt-4 border-t border-border/60 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-primary" />
              What do you need?
            </span>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Farmer-led pricing with transparent buyer visibility
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {/* 1. Buyer Type */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Buyer Type *
              </label>
              <select
                value={buyerType}
                onChange={(e) => setBuyerType(e.target.value)}
                className="w-full h-9 text-xs font-semibold rounded-xl bg-background border border-input px-3"
              >
                {BUYER_TYPE_OPTIONS.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>

            {/* 2. Intended Use / Purpose */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Intended Use / Purpose *
              </label>
              <select
                value={intendedUse}
                onChange={(e) => setIntendedUse(e.target.value)}
                className="w-full h-9 text-xs font-semibold rounded-xl bg-background border border-input px-3"
              >
                {INTENDED_USE_OPTIONS.map((iu) => (
                  <option key={iu} value={iu}>{iu}</option>
                ))}
              </select>
            </div>

            {/* 3. Category Selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setCategory(newCat);
                  if (newCat === "Fruit" && !FRESH_PRODUCE_CATALOG.fruits.includes(crop)) {
                    setCrop("Banana");
                  } else if (newCat === "Vegetable" && !FRESH_PRODUCE_CATALOG.vegetables.includes(crop)) {
                    setCrop("Tomato");
                  }
                }}
                className="w-full h-9 text-xs font-semibold rounded-xl bg-background border border-input px-3"
              >
                <option value="Vegetable">Vegetable</option>
                <option value="Fruit">Fruit</option>
              </select>
            </div>

            {/* 4. Produce Name / Dropdown */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Produce / Crop *
              </label>
              <div className="relative">
                <Input
                  list="produce-list"
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  placeholder="e.g. Tomato, Potato"
                  className="h-9 text-xs font-semibold rounded-xl bg-background"
                />
                <datalist id="produce-list">
                  {produceSuggestions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* 5. Required Quantity (kg) */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                {activeSourcingOrder ? "Remaining to Match (kg)" : "Required Quantity (kg) *"}
              </label>
              <Input
                type="number"
                step="50"
                min="1"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                placeholder="1000"
                className="h-9 text-xs font-bold font-mono rounded-xl bg-background"
              />
            </div>

            {/* 6. Quality / Condition Grade */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Acceptable Quality / Grade *
              </label>
              <select
                value={qualityGrade}
                onChange={(e) => setQualityGrade(e.target.value)}
                className="w-full h-9 text-xs font-semibold rounded-xl bg-background border border-input px-3"
              >
                {MARKET_INTELLIGENCE_GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* 7. Required-by Date */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Required-by Date *
              </label>
              <Input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="h-9 text-xs font-semibold rounded-xl bg-background"
              />
            </div>

            {/* 8. Delivery Location */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Delivery Location *
              </label>
              <Input
                value={destinationCity}
                onChange={(e) => setDestinationCity(e.target.value)}
                placeholder="Madurai, Chennai, etc."
                className="h-9 text-xs font-semibold rounded-xl bg-background"
              />
            </div>

            {/* 9. Maximum Acceptable Price per kg */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1" title="Filters out farmer lots exceeding your budget ceiling">
                Budget Ceiling (Max ₹/kg)
              </label>
              <Input
                type="number"
                step="1"
                min="1"
                value={maxPricePerKg}
                onChange={(e) => setMaxPricePerKg(e.target.value)}
                placeholder="32"
                className="h-9 text-xs font-bold font-mono rounded-xl bg-background"
              />
            </div>

            {/* 10. Primary CTA Button: Smart Supply Match */}
            <div className="flex items-end">
              <Button
                onClick={runMatching}
                disabled={isCalculating}
                className="w-full h-9 rounded-xl text-xs font-bold gap-1.5 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isCalculating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span>Smart Supply Match</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Procurement Workspace Grid: Map + Recommendation / Customizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Procurement Map */}
        <div className="lg:col-span-5 space-y-4">
          <SmartMatchMap
            demand={matchingResult?.demand || { crop, quantityKg: Number(quantityKg) || 1000 }}
            candidateSuppliers={matchingResult?.candidateSuppliers || []}
            selectedAllocations={activeCombo?.allocations || []}
            matchType={matchType}
          />

          {/* Sourcing Guidance Box */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Info className="h-4 w-4 text-primary" />
              <span>Multi-Farmer Aggregation Model</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              When a buyer requires {Number(quantityKg).toLocaleString()} kg of {crop}, individual smallholder lots are aggregated to fulfill the procurement demand without waiting indefinitely for a single supplier.
            </p>
          </div>
        </div>

        {/* Right Column: Recommendation or Manual Customizer */}
        <div className="lg:col-span-7 space-y-4">
          <AnimatePresence mode="wait">
            {viewMode === "RECOMMENDATION" ? (
              <motion.div
                key="recommendation_view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <SmartMatchRecommendation
                  demand={matchingResult?.demand || { crop, quantityKg: Number(quantityKg) || 1000 }}
                  combinations={matchingResult?.combinations || []}
                  matchType={matchType}
                  selectedComboIndex={selectedComboIndex}
                  onSelectComboIndex={setSelectedComboIndex}
                  onAccept={handleAcceptRecommendation}
                  onCustomize={() => setViewMode("CUSTOMIZE")}
                />
              </motion.div>
            ) : (
              <motion.div
                key="customize_view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <SupplierSelector
                  demand={matchingResult?.demand || { crop, quantityKg: Number(quantityKg) || 1000 }}
                  candidateSuppliers={matchingResult?.candidateSuppliers || []}
                  initialAllocations={activeCombo?.allocations || []}
                  onConfirm={handleConfirmCustom}
                  onCancel={() => setViewMode("RECOMMENDATION")}
                  onReset={() => {
                    setViewMode("RECOMMENDATION");
                    setSelectedComboIndex(0);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Procurement Orders & Partial Sourcing Lifecycle History */}
      {recentOrders.length > 0 && (
        <div className="bg-card rounded-3xl border border-border/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Fresh Produce Procurement Orders ({recentOrders.length})
              </h4>
              <p className="text-xs text-muted-foreground">
                Track partial sourcing progression, manage required-by deadlines, and plan multi-farmer fulfillment.
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadOrders}
              disabled={ordersLoading}
              className="text-xs text-muted-foreground hover:text-foreground gap-1 h-8 rounded-xl"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${ordersLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentOrders.map((ord) => {
              const reqKg = Number(ord.demand?.requestedQuantityKg || ord.summary?.requestedQuantityKg || ord.summary?.totalQuantityKg || 1000);
              const sourcedKg = Number(ord.summary?.sourcedQuantityKg !== undefined ? ord.summary.sourcedQuantityKg : (ord.summary?.totalQuantityKg || 0));
              const remainingKg = ord.summary?.remainingQuantityKg !== undefined ? Number(ord.summary.remainingQuantityKg) : Math.max(0, reqKg - sourcedKg);
              const ordVal = ord.summary?.totalProduceCost || ord.summary?.totalProduceValue || ord.summary?.totalEstimatedCost || 0;
              const isPartiallySourced = ord.status === ORDER_STATUS.PARTIALLY_SOURCED || ord.status === "PARTIALLY_SOURCED";
              const isFinalized = ord.status === ORDER_STATUS.FULLY_SOURCED || ord.status === ORDER_STATUS.CONFIRMED || ord.status === ORDER_STATUS.PARTIALLY_FULFILLED || ord.status === "FULLY_SOURCED" || ord.status === "CONFIRMED" || ord.status === "PARTIALLY_FULFILLED";
              const isPaid = ord.summary?.paymentStatus === "PAID_SIMULATED";
              const deadlinePassed = isRequiredByReached(ord.demand?.requiredDate);

              return (
                <div
                  key={ord.orderId || ord.id}
                  className="p-4 rounded-2xl border border-border/80 bg-background hover:border-primary/40 transition-all shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold font-mono text-xs text-primary">{ord.orderId}</span>
                        <h5 className="font-bold text-sm text-foreground mt-0.5">
                          {ord.demand?.crop}
                        </h5>
                        <p className="text-[11px] text-muted-foreground">{ord.buyer?.businessName || "ABC Foods"}</p>
                      </div>
                      {renderStatusBadge(ord.status, ord.summary?.paymentStatus)}
                    </div>

                    {/* Sourcing Quantity & Progress Meter */}
                    <div className="bg-muted/40 p-3 rounded-2xl text-xs space-y-2 border border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-semibold">Sourcing Progress</span>
                        <span className="font-mono font-bold text-foreground">
                          {sourcedKg.toLocaleString()} / {reqKg.toLocaleString()} kg
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            isPartiallySourced ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.round((sourcedKg / reqKg) * 100))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-muted-foreground">
                          {remainingKg > 0 ? (
                            <strong className="text-amber-700 dark:text-amber-400">{remainingKg} kg remaining</strong>
                          ) : (
                            <strong className="text-emerald-600 dark:text-emerald-400">0 kg remaining</strong>
                          )}
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          ₹{ordVal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Required By Date Info */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-primary" />
                        Req by: {ord.demand?.requiredDate || "Immediate"}
                      </span>
                      <span>{ord.allocations?.length || 0} Farmers Pooled</span>
                    </div>

                    {/* Required-by Deadline Decision Banner */}
                    {isPartiallySourced && deadlinePassed && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] space-y-2">
                        <div className="flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>REQUIRED BY REACHED</span>
                        </div>
                        <p className="text-muted-foreground leading-tight">
                          {sourcedKg} / {reqKg} kg sourced. {remainingKg} kg could not be sourced within the required time.
                        </p>
                        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => handleProceedWithPartial(ord)}
                            className="h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2"
                          >
                            Proceed with {sourcedKg} kg
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCloseRequirement(ord)}
                            className="h-7 text-[10px] rounded-lg px-2"
                          >
                            Close
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Actions */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                    {isPartiallySourced && !deadlinePassed ? (
                      <Button
                        size="sm"
                        onClick={() => handleStartContinueSourcing(ord)}
                        className="h-8 text-xs font-bold gap-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl w-full"
                      >
                        <Search className="h-3.5 w-3.5" />
                        <span>Continue Sourcing ({remainingKg} kg)</span>
                      </Button>
                    ) : isFinalized && !isPaid ? (
                      <div className="flex items-center gap-2 w-full">
                        <Button
                          size="sm"
                          onClick={() => navigate(`/payment/${ord.orderId || ord.id}`)}
                          className="h-8 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex-1 shadow-2xs"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>Pay ₹{ordVal.toLocaleString()}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCreatedOrder(ord);
                            setOrderModalOpen(true);
                          }}
                          className="h-8 text-xs rounded-xl px-2.5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCreatedOrder(ord);
                          setOrderModalOpen(true);
                        }}
                        className="h-8 text-xs font-semibold text-primary hover:text-primary/90 w-full justify-center"
                      >
                        <span>View Order Details →</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Procurement Order Summary Dialog */}
      <ProcurementOrderModal
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
        order={createdOrder}
        onProceedWithPartial={handleProceedWithPartial}
        onCloseRequirement={handleCloseRequirement}
        onContinueSourcing={handleStartContinueSourcing}
      />
    </div>
  );
}


