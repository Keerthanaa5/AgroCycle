import React, { useState } from "react";
import { 
  Bot, 
  Sparkles, 
  CheckCircle2, 
  MapPin, 
  Users, 
  ChevronRight, 
  SlidersHorizontal, 
  ArrowRight, 
  ShieldCheck, 
  Info,
  Calendar,
  DollarSign,
  Camera,
  CameraOff,
  Eye,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import ProducePhotoPreviewModal from "./ProducePhotoPreviewModal";

/**
 * Reusable Smart Match Recommendation Component (Phase 1)
 *
 * Displays SMART PROCUREMENT RECOMMENDATION with multi-farmer allocation table,
 * pure procurement economics (Produce Value, Average Price, Matched Quantity, Fulfilment %),
 * and Accept / Customize actions.
 */
export default function SmartMatchRecommendation({
  demand = {},
  combinations = [],
  matchType = "MARKET",
  onAccept = null,
  onCustomize = null,
  selectedComboIndex = 0,
  onSelectComboIndex = null,
  className = ""
}) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [previewSupplier, setPreviewSupplier] = useState(null);
  const activeIndex = onSelectComboIndex ? selectedComboIndex : internalIndex;
  const setActiveIndex = onSelectComboIndex || setInternalIndex;

  if (!combinations || combinations.length === 0) {
    return (
      <div className={`p-6 rounded-3xl border border-dashed border-border/80 bg-muted/20 text-center space-y-3 ${className}`}>
        <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <h4 className="font-bold text-foreground">No eligible farmer supply found for this requirement.</h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
            Unable to assemble a multi-farmer supply pool matching {demand.crop || "the requested produce"} within regional procurement radius.
          </p>
        </div>
        {onCustomize && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCustomize(null)}
            className="rounded-xl text-xs gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Explore All Available Suppliers
          </Button>
        )}
      </div>
    );
  }

  const activeCombo = combinations[activeIndex] || combinations[0];
  const targetKg = Number(demand.quantityKg || (demand.quantityTonnes ? demand.quantityTonnes * 1000 : activeCombo.targetQuantityKg || 1000));
  const cropName = demand.crop || demand.produce || activeCombo.allocations?.[0]?.crop || "Fresh Produce";
  const isMarketProduce = matchType === "MARKET";

  return (
    <div className={`rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs space-y-4 ${className}`}>
      {/* Top Banner: Smart Assistant Header */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs shrink-0 mt-0.5">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/30 text-[11px] font-bold gap-1 px-2.5">
                  <Sparkles className="h-3 w-3" />
                  SMART PROCUREMENT RECOMMENDATION
                </Badge>
                <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/80">
                  {matchType} Pipeline
                </Badge>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground">
                {cropName} — <span className="text-primary">{activeCombo.totalQuantityKg?.toLocaleString()} / {targetKg.toLocaleString()} kg</span>
                <span className="text-xs ml-2 px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {activeCombo.fulfillmentPercentage}% Fulfilled
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {demand.buyerType ? `${demand.buyerType} demand (${demand.intendedUse || "Procurement"})` : "Multi-farmer supply pool assembled to fulfill buyer requirement"} with direct farm-gate pricing.
              </p>
            </div>
          </div>

          {/* Combination Selector Tabs (If multiple options exist) */}
          {combinations.length > 1 && (
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-2xl border border-border/60 self-start sm:self-auto">
              {combinations.map((combo, idx) => (
                <Button
                  key={combo.combinationId || idx}
                  size="sm"
                  variant={activeIndex === idx ? "default" : "ghost"}
                  className={`h-8 text-xs rounded-xl px-3 font-semibold ${
                    activeIndex === idx ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveIndex(idx)}
                >
                  Option {idx + 1}
                  {combo.archetypeId === "OPTIMAL_PROXIMITY" && " (Best)"}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6 pt-0">
        {/* Active Archetype Tag & Description */}
        <div className="bg-muted/40 p-4 rounded-2xl border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">{activeCombo.archetypeName}</span>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold">
                {activeCombo.archetypeBadge}
              </Badge>
            </div>
            <p className="text-muted-foreground text-[11px] mt-1 leading-relaxed">
              {activeCombo.description}
            </p>
          </div>

          {/* Metric Pill */}
          <div className="flex items-center gap-3 bg-background/80 p-2.5 rounded-xl border border-border/60 shrink-0 text-center">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Match Score</span>
              <span className="text-base font-bold text-primary font-mono">{activeCombo.score}/100</span>
            </div>
            <div className="w-px h-7 bg-border/80" />
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Farmers Pooled</span>
              <span className="text-base font-bold text-foreground font-mono">{activeCombo.suppliersCount}</span>
            </div>
          </div>
        </div>

        {/* Multi-Farmer Supply Breakdown Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              Farmer Allocations Breakdown
            </h4>
            <span className="text-xs font-semibold text-foreground">
              Total Matched: <strong className="text-primary font-bold">{activeCombo.totalQuantityKg?.toLocaleString()} kg</strong> / {targetKg.toLocaleString()} kg
            </span>
          </div>

          {/* Farmer-led Pricing Banner */}
          <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200">
            <div className="flex items-center gap-1.5 font-semibold text-[11px]">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Farmer-led pricing with transparent buyer visibility:</span>
              <span className="font-normal text-muted-foreground">Farmers set their own produce rates; buyers see direct farm-gate prices with zero hidden markups.</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 overflow-hidden bg-background">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                  <tr>
                    <th className="p-3">Farmer</th>
                    <th className="p-3">Produce Photos</th>
                    <th className="p-3 text-right">Available</th>
                    <th className="p-3 text-right">Allocated</th>
                    <th className="p-3">Distance</th>
                    <th className="p-3">Quality</th>
                    <th className="p-3 text-right">Farmer Asking Price</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {activeCombo.allocations.map((alloc, idx) => {
                    const photos = Array.isArray(alloc.images) && alloc.images.length > 0 
                      ? alloc.images 
                      : (alloc.image_url || alloc.image ? [alloc.image_url || alloc.image] : []);
                    const hasPhotos = photos.length > 0;

                    return (
                      <tr key={alloc.supplierId || idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <div>
                              <span className="font-bold text-foreground block">{alloc.farmerName}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{alloc.location?.city || "Madurai"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          {hasPhotos ? (
                            <button
                              type="button"
                              onClick={() => setPreviewSupplier(alloc)}
                              className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 hover:bg-primary/10 border border-border/70 hover:border-primary/40 transition-all cursor-pointer group text-left"
                              title="Click to inspect harvest photos"
                            >
                              <div className="h-7 w-7 rounded-lg overflow-hidden border border-border/70 bg-background shrink-0">
                                <img
                                  src={photos[0]}
                                  alt={alloc.crop}
                                  className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                                />
                              </div>
                              <span className="text-[10px] font-semibold text-primary group-hover:underline flex items-center gap-0.5 pr-1">
                                <Eye className="h-2.5 w-2.5" />
                                {photos.length} photo{photos.length !== 1 ? "s" : ""}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPreviewSupplier(alloc)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 px-2 py-1 rounded-lg border border-border/50 hover:border-border hover:bg-muted/70 transition-colors cursor-pointer"
                              title="No photos uploaded"
                            >
                              <CameraOff className="h-3 w-3 text-muted-foreground/70" />
                              <span>No photos</span>
                            </button>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {alloc.availableQuantityKg?.toLocaleString()} kg
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-primary">
                          {alloc.allocatedQuantityKg?.toLocaleString()} kg
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {alloc.distanceKm !== null ? `${alloc.distanceKm} km` : "Local"}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] bg-secondary border-border/70 font-semibold">
                            {alloc.qualityGrade || "Grade A"}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-mono text-foreground">
                          ₹{alloc.pricePerKg}/kg
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">
                          ₹{alloc.farmerSubtotal?.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Smart Match Explanation Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-background to-muted/40 border border-emerald-500/30 text-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Badge className="bg-emerald-600 text-white font-bold text-[10px] gap-1 px-2 py-0.5">
                  <CheckCircle2 className="h-3 w-3" />
                  MATCHED & EXPLAINED
                </Badge>
                <span className="text-xs font-bold text-foreground">Smart Matching Compatibility Breakdown</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">
                Transparent multi-dimensional evaluation
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-background/80 border border-border/60">
                <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">✓</span>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Crop</span>
                  <span className="font-bold text-foreground text-xs">{cropName}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-background/80 border border-border/60">
                <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">✓</span>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Quality & Grade</span>
                  <span className="font-bold text-foreground text-xs">{activeCombo.allocations?.[0]?.qualityGrade || demand.qualityGrade || "Grade A — Fresh / Premium"}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-background/80 border border-border/60">
                <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">✓</span>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Intended Use</span>
                  <span className="font-bold text-foreground text-xs">{demand.intendedUse || "Fresh Retail"}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-background/80 border border-border/60">
                <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">✓</span>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Quantity</span>
                  <span className="font-bold text-foreground text-xs">{activeCombo.totalQuantityKg?.toLocaleString()} / {targetKg.toLocaleString()} kg</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-background/80 border border-border/60">
                <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">✓</span>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Availability</span>
                  <span className="font-bold text-foreground text-xs">Available before required date</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-background/80 border border-border/60">
                <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">✓</span>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Location</span>
                  <span className="font-bold text-foreground text-xs">Location compatible ({activeCombo.averageDistanceKm ? `${activeCombo.averageDistanceKm} km avg` : "Regional source"})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fulfillment Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                Formula: {activeCombo.allocations.map((a) => `${a.farmerName.split(" ")[0]} (${a.allocatedQuantityKg}kg)`).join(" + ")} = {activeCombo.totalQuantityKg?.toLocaleString()} kg
              </span>
            </div>
            <Badge className="bg-emerald-600 text-white font-bold text-xs">
              {activeCombo.fulfillmentStatus === "EXACT" ? "EXACT MATCH (100%)" : `${activeCombo.fulfillmentPercentage}% FULFILLED`}
            </Badge>
          </div>
        </div>

        {/* Pure Procurement Economics Strip (Logistics kept separate) */}
        <div className="space-y-2">
          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            Procurement Economics
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 text-center">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Total Produce Value</span>
              <span className="text-base font-bold text-primary font-mono mt-0.5 block">
                ₹{activeCombo.totalProduceCost.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">Direct farm-gate payout</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 text-center">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Average Produce Price</span>
              <span className="text-base font-bold text-foreground font-mono mt-0.5 block">
                ₹{activeCombo.averageProducePrice}/kg
              </span>
              <span className="text-[10px] text-muted-foreground">Weighted average rate</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 text-center">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Matched Quantity</span>
              <span className="text-base font-bold text-foreground font-mono mt-0.5 block">
                {activeCombo.totalQuantityKg?.toLocaleString()} kg
              </span>
              <span className="text-[10px] text-muted-foreground">Across {activeCombo.suppliersCount} farmers</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 text-center">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Fulfilment</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                {activeCombo.fulfillmentPercentage}%
              </span>
              <span className="text-[10px] text-muted-foreground">Requirement satisfied</span>
            </div>
          </div>
        </div>

        {/* Scoring Rationale Explanation */}
        <div className="p-3 rounded-xl bg-background border border-border/60 text-[11px] text-muted-foreground flex items-start gap-2">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            <strong>Deterministic Matching:</strong> {activeCombo.scoreExplanation}
          </span>
        </div>

        {/* Interactive Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/60">
          <Button
            variant="outline"
            onClick={() => onCustomize && onCustomize(activeCombo)}
            className="w-full sm:w-auto rounded-xl text-xs font-semibold gap-2 h-10 border-border/80 hover:bg-muted"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            Customize Selection
          </Button>

          <Button
            onClick={() => onAccept && onAccept(activeCombo)}
            className="w-full sm:w-auto rounded-xl text-xs font-bold gap-2 h-10 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground px-6"
          >
            <CheckCircle2 className="h-4 w-4" />
            ACCEPT RECOMMENDATION ({activeCombo.totalQuantityKg?.toLocaleString()} kg)
          </Button>
        </div>
      </div>

      {/* Produce Photo Inspection Lightbox Modal */}
      <ProducePhotoPreviewModal
        open={Boolean(previewSupplier)}
        onOpenChange={(open) => !open && setPreviewSupplier(null)}
        supplier={previewSupplier}
      />
    </div>
  );
}
