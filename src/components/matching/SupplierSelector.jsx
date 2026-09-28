import React, { useState, useEffect, useMemo } from "react";
import { 
  Check, 
  SlidersHorizontal, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Users, 
  MapPin, 
  RotateCcw, 
  ArrowRight,
  ShieldCheck,
  Plus,
  Minus,
  Camera,
  CameraOff,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { calculateFulfillmentKg, calculateFulfillment, FULFILLMENT_STATUS } from "@/services/smartMatchService";
import { motion } from "framer-motion";
import ProducePhotoPreviewModal from "./ProducePhotoPreviewModal";

/**
 * Reusable Custom Supplier Selector Component (Phase 1)
 *
 * Allows the buyer to remain in complete control:
 * 1. Viewing all compatible available suppliers.
 * 2. Selecting / unselecting farmers via checkboxes.
 * 3. Adjusting exact quantity allocations per farmer in kg.
 * 4. Tracking fulfillment dynamically (DEFICIT, EXACT MATCH, EXCESS).
 */
export default function SupplierSelector({
  demand = {},
  candidateSuppliers = [],
  initialAllocations = [],
  onConfirm = null,
  onCancel = null,
  onReset = null,
  className = ""
}) {
  const isKgUnit = demand.unit === "kg" || demand.quantityKg || !demand.quantityTonnes;
  const targetQuantityKg = Number(demand.quantityKg || (demand.quantityTonnes ? demand.quantityTonnes * 1000 : 1000));
  const cropName = demand.crop || "Fresh Produce";

  // State: map of supplier ID -> { selected: boolean, allocatedKg: number }
  const [allocMap, setAllocMap] = useState({});
  const [previewSupplier, setPreviewSupplier] = useState(null);

  useEffect(() => {
    const initialMap = {};
    candidateSuppliers.forEach((s) => {
      const match = initialAllocations.find(
        (a) => a.supplierId === s.id || a.farmerId === s.farmerId || a.id === s.id
      );
      const sAvailKg = Number(s.availableQuantityKg || Math.round((s.availableQuantityTonnes || 0) * 1000));
      if (match) {
        const allocKg = Number(match.allocatedQuantityKg || Math.round((match.allocatedQuantityTonnes || 0) * 1000) || sAvailKg);
        initialMap[s.id] = {
          selected: true,
          allocatedKg: allocKg
        };
      } else {
        initialMap[s.id] = {
          selected: false,
          allocatedKg: sAvailKg
        };
      }
    });
    setAllocMap(initialMap);
  }, [candidateSuppliers, initialAllocations]);

  // Toggle selection
  const handleToggle = (supplierId, defaultAvailableKg) => {
    setAllocMap((prev) => {
      const current = prev[supplierId] || { selected: false, allocatedKg: defaultAvailableKg };
      return {
        ...prev,
        [supplierId]: {
          selected: !current.selected,
          allocatedKg: current.allocatedKg || defaultAvailableKg
        }
      };
    });
  };

  // Adjust allocated kg for a supplier
  const handleQuantityChange = (supplierId, newQtyKg, maxAvailableKg) => {
    const rawVal = Number(newQtyKg);
    const num = isNaN(rawVal) ? 0 : Math.max(0.01, Math.min(maxAvailableKg, rawVal));
    setAllocMap((prev) => ({
      ...prev,
      [supplierId]: {
        selected: true,
        allocatedKg: num
      }
    }));
  };

  // Compile active selected list
  const selectedList = useMemo(() => {
    const list = [];
    candidateSuppliers.forEach((s) => {
      const state = allocMap[s.id];
      if (state?.selected && state.allocatedKg > 0) {
        const kg = state.allocatedKg;
        const tonnes = Number((kg / 1000).toFixed(2));
        const pricePerKg = Number(s.pricePerKg || 25);
        list.push({
          ...s,
          supplierId: s.id,
          allocatedQuantityKg: kg,
          allocatedQuantityTonnes: tonnes,
          pricePerKg: pricePerKg,
          farmerSubtotal: Math.round(kg * pricePerKg)
        });
      }
    });
    return list;
  }, [candidateSuppliers, allocMap]);

  // Dynamic Fulfillment status calculation
  const fulfillment = calculateFulfillmentKg(selectedList, targetQuantityKg);

  const handleConfirm = () => {
    if (onConfirm && selectedList.length > 0) {
      onConfirm(selectedList);
    }
  };

  return (
    <div className={`rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs space-y-4 ${className}`}>
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-border/60 bg-muted/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold gap-1">
                <SlidersHorizontal className="h-3 w-3" />
                Buyer Supply Customizer
              </Badge>
              <span className="text-xs text-muted-foreground">Manual Control Mode</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-foreground">
              Customize Supply Allocation: {cropName} ({targetQuantityKg.toLocaleString()} kg)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select or swap regional farmers and specify exact quantities in kg to construct your procurement lot.
            </p>
          </div>

          {onReset && (
            <Button
              size="sm"
              variant="outline"
              onClick={onReset}
              className="rounded-xl text-xs gap-1.5 h-8 self-start sm:self-auto"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Recommendation
            </Button>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6 pt-0">
        {/* Dynamic Fulfillment Progress Tracker */}
        <div className="bg-muted/40 p-4 rounded-2xl border border-border/70 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">
              Selected: <strong className="text-primary text-sm font-mono">{fulfillment.selectedTotalKg.toLocaleString()} kg</strong> / {fulfillment.targetTotalKg.toLocaleString()} kg
            </span>
            <Badge className={`text-xs font-bold ${
              fulfillment.status === FULFILLMENT_STATUS.EXACT 
                ? "bg-emerald-600 text-white" 
                : (fulfillment.status === FULFILLMENT_STATUS.DEFICIT 
                    ? "bg-amber-500 text-slate-950 font-extrabold" 
                    : "bg-blue-600 text-white")
            }`}>
              {fulfillment.badgeText}
            </Badge>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full bg-border/60 h-2.5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 rounded-full ${
                fulfillment.status === FULFILLMENT_STATUS.EXACT 
                  ? "bg-emerald-500" 
                  : (fulfillment.status === FULFILLMENT_STATUS.DEFICIT ? "bg-amber-500" : "bg-blue-500")
              }`}
              style={{ width: `${Math.min(100, fulfillment.percentFulfillment)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{selectedList.length} farmer{selectedList.length !== 1 ? "s" : ""} selected</span>
            <span>{fulfillment.percentFulfillment}% Fulfilled ({fulfillment.statusText})</span>
          </div>
        </div>

        {/* Farmers Interactive Selection Table / List */}
        <div className="space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            Compatible Regional Farmers ({candidateSuppliers.length})
          </h4>

          <div className="space-y-2.5">
            {candidateSuppliers.map((s) => {
              const sAvailKg = Number(s.availableQuantityKg || Math.round((s.availableQuantityTonnes || 0) * 1000));
              const state = allocMap[s.id] || { selected: false, allocatedKg: sAvailKg };
              const isChecked = Boolean(state.selected);
              const photos = Array.isArray(s.images) && s.images.length > 0
                ? s.images
                : (s.image_url || s.image ? [s.image_url || s.image] : []);
              const hasPhotos = photos.length > 0;

              return (
                <div
                  key={s.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isChecked
                      ? "border-primary bg-primary/5 shadow-2xs"
                      : "border-border/80 bg-background hover:border-border"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Checkbox and Farmer info */}
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(s.id, sAvailKg)}
                        className="h-4 w-4 rounded-md mt-1 text-primary focus:ring-primary cursor-pointer"
                        id={`check_${s.id}`}
                      />
                      <label htmlFor={`check_${s.id}`} className="cursor-pointer flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{s.farmerName}</span>
                          <Badge variant="outline" className="text-[10px] bg-background">
                            {s.qualityGrade || "Grade A"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5 text-primary" />
                            {s.location?.city || "Madurai"} • {s.distanceKm !== null ? `${s.distanceKm} km` : "Local"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Available: <strong className="text-foreground">{sAvailKg.toLocaleString()} kg</strong> • Farmer Asking Price: <strong className="text-primary">₹{s.pricePerKg}/kg</strong> <span className="text-[10px] text-muted-foreground font-normal">(Farmer-set, read-only)</span>
                        </p>
                      </label>
                    </div>

                    {/* Produce Photo Inspection Button / Thumbnail */}
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {hasPhotos ? (
                        <button
                          type="button"
                          onClick={() => setPreviewSupplier(s)}
                          className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 hover:bg-primary/10 border border-border/70 hover:border-primary/40 transition-all cursor-pointer group text-left"
                          title="Inspect Produce Photos"
                        >
                          <div className="h-8 w-8 rounded-lg overflow-hidden border border-border/70 bg-background shrink-0">
                            <img
                              src={photos[0]}
                              alt={s.crop}
                              className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-primary group-hover:underline flex items-center gap-0.5 pr-1.5">
                            <Eye className="h-2.5 w-2.5" />
                            {photos.length} photo{photos.length !== 1 ? "s" : ""}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPreviewSupplier(s)}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 px-2 py-1.5 rounded-lg border border-border/50 hover:border-border hover:bg-muted/70 transition-colors cursor-pointer"
                          title="No photos uploaded"
                        >
                          <CameraOff className="h-3 w-3 text-muted-foreground/70" />
                          <span>No photos</span>
                        </button>
                      )}
                    </div>

                    {/* Quantity Allocation Input (when checked) */}
                    {isChecked && (
                      <div className="flex items-center gap-2 bg-background p-1.5 rounded-xl border border-border/80 self-end sm:self-auto">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground pl-1.5">Allocated:</span>
                        <Input
                          type="number"
                          step="any"
                          min="0.01"
                          max={sAvailKg}
                          value={state.allocatedKg}
                          onChange={(e) => handleQuantityChange(s.id, e.target.value, sAvailKg)}
                          className="w-24 h-7 text-xs font-bold font-mono text-center rounded-lg"
                        />
                        <span className="text-xs font-bold text-primary pr-1">kg</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/60">
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="w-full sm:w-auto rounded-xl text-xs h-10"
            >
              Cancel Customization
            </Button>
          )}

          <Button
            onClick={handleConfirm}
            disabled={selectedList.length === 0}
            className="w-full sm:w-auto rounded-xl text-xs font-bold gap-2 h-10 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground px-6"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirm Custom Selection ({fulfillment.selectedTotalKg.toLocaleString()} kg)
          </Button>
        </div>
      </div>

      {/* Produce Photo Inspection Modal */}
      <ProducePhotoPreviewModal
        open={Boolean(previewSupplier)}
        onOpenChange={(open) => !open && setPreviewSupplier(null)}
        supplier={previewSupplier}
      />
    </div>
  );
}

