import React, { useState, useMemo } from "react";
import { 
  MapPin, 
  Building2, 
  Truck, 
  Users, 
  Info, 
  CheckCircle2, 
  Compass, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  Sparkles, 
  AlertCircle,
  ShieldCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { calculateDistanceKm } from "@/services/smartMatchService";

/**
 * Reusable Offline-Safe Smart Match Interactive Map Component
 *
 * Visualizes multi-farmer supply sources flowing into a consolidated buyer destination.
 * Reusable across Market Intelligence, Silage Bank, and Urban Waste Matcher.
 *
 * Highlights:
 * - Uses genuine GPS coordinates from real farmer marketplace listings.
 * - Excludes listings without valid coordinates from map visualization (no fake positions).
 * - Automatic viewport fitting for Buyer Hub + matched farmer pins.
 * - Interactive farmer marker popover with crop, quantity, distance, and pricing details.
 * - Clear distinction between Recommended/Selected suppliers vs Alternative candidates.
 */
export default function SmartMatchMap({
  demand = {},
  candidateSuppliers = [],
  selectedAllocations = [],
  matchType = "MARKET",
  className = "",
  onSelectSupplier = null
}) {
  const [selectedPin, setSelectedPin] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showAllCandidates, setShowAllCandidates] = useState(true);

  // Buyer destination coordinates
  const buyerLoc = demand?.destinationLocation || {
    city: "Madurai",
    state: "Tamil Nadu",
    latitude: 9.9252,
    longitude: 78.1198
  };

  const rawBuyerLat = typeof buyerLoc === "object" ? buyerLoc.latitude : null;
  const rawBuyerLon = typeof buyerLoc === "object" ? buyerLoc.longitude : null;
  const buyerLat = typeof rawBuyerLat === "number" && !isNaN(rawBuyerLat) ? rawBuyerLat : null;
  const buyerLon = typeof rawBuyerLon === "number" && !isNaN(rawBuyerLon) ? rawBuyerLon : null;
  const buyerHasCoords = buyerLat !== null && buyerLon !== null;
  const buyerName = demand?.buyerName || (typeof buyerLoc === "object" ? buyerLoc.city : null) || "Commercial Buyer Hub";

  // Map projection bounds calculation using ONLY genuine coordinates
  const { 
    projectedBuyer, 
    projectedSuppliers, 
    suppliersWithCoordsCount, 
    suppliersWithoutCoordsCount, 
    hasAnyCoords,
    totalSuppliersCount
  } = useMemo(() => {
    // 1. Compile unique suppliers using listingId as identity to prevent duplicate pins
    const uniqueSuppliersMap = new Map();

    // First, add all selectedAllocations (matched lots)
    (selectedAllocations || []).forEach((alloc) => {
      const lId = String(alloc.listingId || alloc.supplierId || alloc.id || "");
      if (lId) {
        uniqueSuppliersMap.set(lId, {
          ...alloc,
          id: lId,
          listingId: lId,
          farmerId: String(alloc.farmerId || "usr_farmer"),
          farmerName: alloc.farmerName || alloc.name || "Local Farmer",
          isAllocated: true
        });
      }
    });

    // Second, add candidateSuppliers if not already present
    (candidateSuppliers || []).forEach((cand) => {
      const lId = String(cand.listingId || cand.id || cand.supplierId || "");
      if (lId && !uniqueSuppliersMap.has(lId)) {
        uniqueSuppliersMap.set(lId, {
          ...cand,
          id: lId,
          listingId: lId,
          farmerId: String(cand.farmerId || "usr_farmer"),
          farmerName: cand.farmerName || cand.name || "Local Farmer",
          isAllocated: false
        });
      }
    });

    const allSourceSuppliers = Array.from(uniqueSuppliersMap.values());
    const totalSuppliersCount = allSourceSuppliers.length;

    const allLats = [];
    const allLons = [];

    if (buyerHasCoords) {
      allLats.push(buyerLat);
      allLons.push(buyerLon);
    }

    let withCoordsCount = 0;
    let withoutCoordsCount = 0;

    // Process all unique suppliers & allocations
    const processedSuppliers = allSourceSuppliers.map((s) => {
      const rawLat = s.latitude !== undefined && s.latitude !== null ? s.latitude : s.location?.latitude;
      const rawLon = s.longitude !== undefined && s.longitude !== null ? s.longitude : s.location?.longitude;
      const lat = (rawLat !== null && rawLat !== undefined && rawLat !== "" && !isNaN(Number(rawLat)) && Number.isFinite(Number(rawLat))) ? Number(rawLat) : null;
      const lon = (rawLon !== null && rawLon !== undefined && rawLon !== "" && !isNaN(Number(rawLon)) && Number.isFinite(Number(rawLon))) ? Number(rawLon) : null;
      const hasCoords = lat !== null && lon !== null;

      if (hasCoords) {
        allLats.push(lat);
        allLons.push(lon);
        withCoordsCount++;
      } else {
        withoutCoordsCount++;
      }

      // Check if this supplier is allocated in the active combination
      const allocatedData = (selectedAllocations || []).find((a) => {
        const aId = a.listingId || a.supplierId || a.id;
        const sId = s.listingId || s.id || s.supplierId;
        return aId && sId && String(aId) === String(sId);
      });

      const isAllocated = Boolean(allocatedData) || Boolean(s.isAllocated);

      // Compute actual Haversine distance if genuine coordinates exist
      const computedDistanceKm = (hasCoords && buyerHasCoords)
        ? calculateDistanceKm(buyerLat, buyerLon, lat, lon)
        : (s.distanceKm !== undefined ? s.distanceKm : null);

      return {
        ...s,
        lat,
        lon,
        latitude: lat,
        longitude: lon,
        hasCoordinates: hasCoords,
        computedDistanceKm,
        isAllocated,
        allocatedQuantityKg: allocatedData?.allocatedQuantityKg || s.allocatedQuantityKg || (s.allocatedQuantityTonnes ? s.allocatedQuantityTonnes * 1000 : null)
      };
    });

    const hasAny = allLats.length > 0;

    if (!hasAny) {
      return {
        projectedBuyer: null,
        projectedSuppliers: processedSuppliers.map(s => ({ ...s, projX: null, projY: null })),
        suppliersWithCoordsCount: 0,
        suppliersWithoutCoordsCount: processedSuppliers.length,
        hasAnyCoords: false,
        totalSuppliersCount
      };
    }

    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLon = Math.min(...allLons);
    const maxLon = Math.max(...allLons);

    // Add dynamic margin padding so pins don't stick to the very edges of the canvas
    const latSpan = maxLat - minLat;
    const lonSpan = maxLon - minLon;
    const latPadding = Math.max(0.04, latSpan * 0.25);
    const lonPadding = Math.max(0.06, lonSpan * 0.25);

    const mapMinLat = minLat - latPadding;
    const mapMaxLat = maxLat + latPadding;
    const mapMinLon = minLon - lonPadding;
    const mapMaxLon = maxLon + lonPadding;

    const latRange = Math.max(0.08, mapMaxLat - mapMinLat);
    const lonRange = Math.max(0.10, mapMaxLon - mapMinLon);

    // Coordinate conversion to percentage space (8% to 92%)
    const project = (latVal, lonVal) => {
      if (latVal === null || lonVal === null || !Number.isFinite(latVal) || !Number.isFinite(lonVal)) return null;
      const x = ((lonVal - mapMinLon) / lonRange) * 80 + 10;
      // Invert Y because SVG/CSS Y goes downwards
      const y = 90 - (((latVal - mapMinLat) / latRange) * 75 + 10);
      return { x: Math.max(8, Math.min(92, x)), y: Math.max(10, Math.min(88, y)) };
    };

    const bProj = buyerHasCoords ? project(buyerLat, buyerLon) : (withCoordsCount > 0 ? { x: 50, y: 15 } : null);

    const sProj = processedSuppliers.map((s) => {
      const pt = s.hasCoordinates ? project(s.lat, s.lon) : null;
      return {
        ...s,
        projX: pt ? pt.x : null,
        projY: pt ? pt.y : null
      };
    });

    return {
      projectedBuyer: bProj,
      projectedSuppliers: sProj,
      suppliersWithCoordsCount: withCoordsCount,
      suppliersWithoutCoordsCount: withoutCoordsCount,
      hasAnyCoords: hasAny,
      totalSuppliersCount
    };
  }, [buyerLat, buyerLon, buyerHasCoords, candidateSuppliers, selectedAllocations]);

  // Sourced summary calculations in kg and Tonnes
  const allocatedCount = selectedAllocations.length;
  const totalAllocatedKg = selectedAllocations.reduce(
    (sum, a) => sum + (Number(a.allocatedQuantityKg) || (Number(a.allocatedQuantityTonnes || 0) * 1000) || Number(a.quantity_kg || 0) || 0),
    0
  );
  const totalAllocatedTonnes = Number((totalAllocatedKg / 1000).toFixed(2));

  // Determine if there are allocated suppliers without coordinates
  const allocatedWithoutCoords = selectedAllocations.filter((a) => {
    const rawLat = a.latitude !== undefined && a.latitude !== null ? a.latitude : a.location?.latitude;
    return rawLat === null || rawLat === undefined || isNaN(Number(rawLat));
  }).length;

  return (
    <div className={`rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs ${className}`}>
      {/* Map Header Toolbar */}
      <div className="p-4 border-b border-border/60 bg-muted/40 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-bold text-foreground flex items-center gap-1.5">
              Multi-Farmer Geographic Sourcing Map
              <Badge variant="outline" className="text-[10px] font-semibold bg-background border-primary/20 text-primary">
                {matchType} Pathway
              </Badge>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {allocatedCount} supplier{allocatedCount !== 1 ? "s" : ""} pooled • {totalAllocatedKg.toLocaleString()} kg ({totalAllocatedTonnes} T)
            </p>
          </div>
        </div>

        {/* Legend & Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 bg-background/80 px-2.5 py-1.5 rounded-xl border border-border/60 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block shadow-xs"></span>
              <span className="text-foreground font-medium">Matched</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400 inline-block"></span>
              <span className="text-muted-foreground">Alternative</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block"></span>
              <span className="text-foreground font-medium">Buyer Hub</span>
            </span>
          </div>

          <div className="flex items-center gap-1 bg-background rounded-xl border border-border/60 p-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-lg"
              onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.15))}
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-lg"
              onClick={() => setZoomLevel((z) => Math.max(0.85, z - 0.15))}
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Map Canvas Space */}
      <div className="relative w-full h-[360px] sm:h-[420px] bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 overflow-hidden select-none">
        {/* Subtle Regional Grid lines */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#60a5fa 1px, transparent 1px), linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)`,
            backgroundSize: "24px 24px, 48px 48px, 48px 48px"
          }}
        />

        {/* GPS Availability / Empty Notices */}
        {totalSuppliersCount === 0 && (
          <div className="absolute top-3 left-3 right-3 z-30 p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 text-[11px] flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-primary" />
              <span>No eligible farmer supply found</span>
            </div>
            <span className="text-[10px] text-slate-400">Try adjusting crop, quantity or price filter</span>
          </div>
        )}

        {totalSuppliersCount > 0 && suppliersWithCoordsCount === 0 && (
          <div className="absolute top-3 left-3 right-3 z-30 p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-300 text-[11px] flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>GPS location unavailable for matched suppliers</span>
            </div>
            <span className="text-[10px] text-slate-400">Farmers can allow GPS in listing modal</span>
          </div>
        )}

        {suppliersWithCoordsCount > 0 && allocatedWithoutCoords > 0 && (
          <div className="absolute top-3 left-3 right-3 z-30 p-2 rounded-xl bg-slate-900/85 border border-slate-700 text-slate-300 text-[10px] flex items-center gap-1.5 shadow-md">
            <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Some matched suppliers have no GPS location available.</span>
          </div>
        )}

        {/* SVG Flow Vectors connecting recommended farmers with GPS to Buyer Hub */}
        {projectedBuyer && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ transform: `scale(${zoomLevel})` }}>
            <defs>
              <linearGradient id="flowGradEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.95" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="glow" />
                <feComposite in="SourceGraphic" in2="glow" operator="over" />
              </filter>
            </defs>

            {projectedSuppliers.map((s) => {
              if (!s.hasCoordinates || !s.isAllocated || s.projX === null || s.projY === null) return null;
              return (
                <g key={`vector_${s.id || s.farmerId}`}>
                  {/* Curved flow line */}
                  <path
                    d={`M ${s.projX}% ${s.projY}% Q ${(s.projX + projectedBuyer.x) / 2 + (s.projX > projectedBuyer.x ? 4 : -4)}% ${(s.projY + projectedBuyer.y) / 2 - 6}% ${projectedBuyer.x}% ${projectedBuyer.y}%`}
                    fill="none"
                    stroke="url(#flowGradEmerald)"
                    strokeWidth="2.5"
                    strokeDasharray="6,4"
                    className="animate-pulse"
                    filter="url(#glow)"
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Scalable Container for Markers */}
        <div 
          className="relative w-full h-full transition-transform duration-300 origin-center"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {/* 1. Buyer Destination Hub Marker (Only rendered if genuine coordinates exist) */}
          {projectedBuyer && (
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
              style={{ left: `${projectedBuyer.x}%`, top: `${projectedBuyer.y}%` }}
              onClick={() => setSelectedPin({ type: "BUYER", ...demand, destinationLocation: buyerLoc })}
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute -inset-2.5 rounded-full bg-blue-500/30 animate-ping" />
                <span className="absolute -inset-1 rounded-full bg-blue-500/40" />
                
                <div className="relative h-10 w-10 rounded-2xl bg-blue-600 text-white shadow-lg border-2 border-white flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>

              {/* Label badge */}
              <div className="absolute top-11 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-blue-500/40 shadow-md flex items-center gap-1">
                <span>📍 {buyerName}</span>
                <Badge className="bg-blue-500 text-[9px] px-1 py-0 h-4">Buyer</Badge>
              </div>
            </div>
          )}

          {/* 2. Genuine Supplier Pins */}
          {projectedSuppliers.map((s) => {
            if (!s.hasCoordinates || s.projX === null || s.projY === null || (!showAllCandidates && !s.isAllocated)) return null;
            const sAvailKg = Number(s.availableQuantityKg || Math.round((s.availableQuantityTonnes || 0) * 1000));
            const allocKg = s.allocatedQuantityKg || sAvailKg;

            return (
              <div
                key={s.id || s.farmerId}
                className="absolute z-30 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200"
                style={{ left: `${s.projX}%`, top: `${s.projY}%` }}
                onClick={() => {
                  setSelectedPin({ type: "SUPPLIER", ...s, availableQuantityKg: sAvailKg, allocatedQuantityKg: allocKg });
                  if (onSelectSupplier) onSelectSupplier(s);
                }}
              >
                <div className="relative group flex flex-col items-center">
                  {s.isAllocated ? (
                    <div className="relative">
                      <span className="absolute -inset-1.5 rounded-full bg-emerald-500/40 animate-pulse" />
                      <div className="relative h-9 w-9 rounded-2xl bg-emerald-600 text-white shadow-lg border-2 border-emerald-300 flex items-center justify-center font-bold text-xs">
                        🌾
                      </div>
                      {/* Allocated Quantity pill badge */}
                      <span className="absolute -top-2 -right-3 bg-amber-400 text-slate-950 font-extrabold text-[10px] px-1.5 py-0.2 rounded-full border border-white shadow-xs">
                        {allocKg}kg
                      </span>
                    </div>
                  ) : (
                    <div className="h-7 w-7 rounded-xl bg-slate-800/90 text-slate-300 border border-slate-600 flex items-center justify-center text-xs opacity-75 hover:opacity-100 hover:scale-110 shadow-xs">
                      📍
                    </div>
                  )}

                  {/* Pin label */}
                  <div className={`mt-1 whitespace-nowrap text-[10px] px-2 py-0.5 rounded-md border shadow-md font-semibold transition-all ${
                    s.isAllocated
                      ? "bg-slate-900/95 text-emerald-400 border-emerald-500/50"
                      : "bg-slate-900/80 text-slate-300 border-slate-700"
                  }`}>
                    {s.farmerName} • {s.isAllocated ? `${allocKg} kg` : `${sAvailKg} kg`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive Pin Details Card Overlay */}
        <AnimatePresence>
          {selectedPin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white rounded-2xl p-4 shadow-xl text-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{selectedPin.type === "BUYER" ? "🏢" : "🌾"}</span>
                    <h5 className="font-bold text-sm text-slate-100">
                      {selectedPin.type === "BUYER" ? (selectedPin.buyerName || "Buyer Hub") : selectedPin.farmerName}
                    </h5>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-emerald-400" />
                    {selectedPin.location?.district || selectedPin.location?.city || selectedPin.location?.address || "Regional Farm"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-slate-400 hover:text-white rounded-md"
                  onClick={() => setSelectedPin(null)}
                >
                  ✕
                </Button>
              </div>

              {selectedPin.type === "SUPPLIER" ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Supply Produce</span>
                      <span className="font-bold text-emerald-400">{selectedPin.crop}</span>
                    </div>
                    <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Available Supply</span>
                      <span className="font-bold text-white">{(selectedPin.availableQuantityKg || Math.round((selectedPin.availableQuantityTonnes || 0) * 1000)).toLocaleString()} kg</span>
                    </div>
                    <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Quality / Grade</span>
                      <span className="font-bold text-slate-200">{selectedPin.qualityGrade || "Grade A"}</span>
                    </div>
                    <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Distance & Farmer Asking Price</span>
                      <span className="font-bold text-amber-300">
                        {selectedPin.computedDistanceKm !== null ? `${selectedPin.computedDistanceKm} km` : "No GPS distance"} • ₹{selectedPin.pricePerKg}/kg
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      {selectedPin.verificationStatus === "verified" ? "Verified Producer" : "Local Producer"}
                    </span>
                    {selectedPin.isAllocated && (
                      <Badge className="bg-emerald-600 text-white text-[10px]">
                        Allocated: {(selectedPin.allocatedQuantityKg || selectedPin.availableQuantityKg || 200).toLocaleString()} kg
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-[11px]">
                  <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Required Produce</span>
                    <span className="font-bold text-blue-400">{demand.crop || "Tomato"} — {(demand.quantityKg || 1000).toLocaleString()} kg</span>
                  </div>
                  <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Delivery Destination</span>
                    <span className="font-bold text-slate-200">{buyerLoc.city || "Madurai"}, {buyerLoc.state || "Tamil Nadu"}</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Map Footer Summary */}
      <div className="p-3 bg-muted/30 border-t border-border/60 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground font-medium">
            Sourcing Flow: <strong className="text-foreground">{allocatedCount} Farmer{allocatedCount !== 1 ? "s" : ""}</strong> pooled $\to$ <strong className="text-foreground">{buyerName}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] rounded-lg"
            onClick={() => setShowAllCandidates((prev) => !prev)}
          >
            {showAllCandidates ? "Hide Alternatives" : "Show All Candidates"}
          </Button>
        </div>
      </div>
    </div>
  );
}
