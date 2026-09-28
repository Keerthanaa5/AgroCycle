import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Camera, 
  CameraOff, 
  Image as ImageIcon, 
  MapPin, 
  Package, 
  DollarSign, 
  ShieldCheck, 
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn
} from "lucide-react";

/**
 * ProducePhotoPreviewModal
 *
 * Allows buyers (and farmers) to inspect the genuine produce photos uploaded for a specific listing.
 * Requirements:
 * - Shows actual produce photos (1-3 photos) uploaded by the farmer.
 * - Shows clear "No photos uploaded" state if farmer didn't attach photos (NO stock/fake images).
 * - Photos belong strictly to the listingId.
 * - Protected privacy: no unnecessary private contact information exposed.
 */
export default function ProducePhotoPreviewModal({
  open = false,
  onOpenChange = () => {},
  supplier = null
}) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Extract photos safely
  const photos = (() => {
    if (!supplier) return [];
    if (Array.isArray(supplier.images) && supplier.images.length > 0) {
      return supplier.images.filter(Boolean);
    }
    if (supplier.image_url || supplier.image) {
      const img = supplier.image_url || supplier.image;
      if (typeof img === "string" && (img.startsWith("[") || img.startsWith("{"))) {
        try {
          const parsed = JSON.parse(img);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
          if (parsed) return [parsed];
        } catch {
          return [img];
        }
      }
      return [img];
    }
    return [];
  })();

  useEffect(() => {
    if (open) {
      setSelectedPhotoIndex(0);
    }
  }, [open, supplier]);

  if (!supplier) return null;

  const cropName = supplier.crop || supplier.produce || supplier.variety || "Fresh Produce";
  const farmerName = supplier.farmerName || supplier.farmer_name || "Verified Regional Farmer";
  const locationCity = supplier.location?.city || supplier.location?.address || supplier.district || "Local Farm";
  const qualityGrade = supplier.qualityGrade || supplier.quality_grade || "Grade A";
  const condition = supplier.condition || "fresh";
  const availableKg = Number(
    supplier.availableQuantityKg ?? 
    supplier.quantity_kg ?? 
    (supplier.availableQuantityTonnes ? supplier.availableQuantityTonnes * 1000 : 0)
  );
  const allocatedKg = supplier.allocatedQuantityKg !== undefined ? Number(supplier.allocatedQuantityKg) : null;
  const pricePerKg = Number(supplier.pricePerKg || supplier.asking_price || 0);

  const activePhoto = photos[selectedPhotoIndex] || photos[0] || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold gap-1 px-2">
                  <Camera className="h-3 w-3" />
                  Produce Photo Inspection
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-secondary border-border/70 font-semibold">
                  {qualityGrade}
                </Badge>
              </div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>{cropName}</span>
                <span className="text-xs font-normal text-muted-foreground font-mono">
                  (Lot: {supplier.listingId || supplier.id})
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-foreground">{farmerName}</span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  {locationCity}
                </span>
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Main Photo Area */}
          <div className="relative rounded-2xl overflow-hidden bg-muted/40 border border-border/80 aspect-4/3 flex items-center justify-center">
            {activePhoto ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black/5 dark:bg-black/40">
                <img
                  src={activePhoto}
                  alt={`${cropName} from ${farmerName}`}
                  className="w-full h-full object-contain transition-all"
                />
                <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  Photo {selectedPhotoIndex + 1} of {photos.length}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground mx-auto flex items-center justify-center">
                  <CameraOff className="h-6 w-6" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-xs text-foreground">No Photos Uploaded</p>
                  <p className="text-[11px] text-muted-foreground max-w-xs">
                    The farmer has not attached harvest photographs for this listing lot.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Thumbnail Gallery Strip (if > 1 photo) */}
          {photos.length > 1 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">
                All Uploaded Photos ({photos.length})
              </span>
              <div className="flex items-center gap-2">
                {photos.map((photo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`h-16 w-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      selectedPhotoIndex === idx
                        ? "border-primary ring-2 ring-primary/20 scale-105"
                        : "border-border/70 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={photo}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Produce Lot Metadata Summary Card */}
          <div className="grid grid-cols-3 gap-2.5 bg-muted/30 p-3 rounded-2xl border border-border/60 text-center text-xs">
            <div className="p-2 bg-background/80 rounded-xl border border-border/40">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                {allocatedKg !== null ? "Allocated Qty" : "Available Qty"}
              </span>
              <span className="font-bold font-mono text-foreground text-sm mt-0.5 block">
                {allocatedKg !== null ? `${allocatedKg.toLocaleString()} kg` : `${availableKg.toLocaleString()} kg`}
              </span>
            </div>

            <div className="p-2 bg-background/80 rounded-xl border border-border/40">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Farm-Gate Rate
              </span>
              <span className="font-bold font-mono text-primary text-sm mt-0.5 block">
                ₹{pricePerKg}/kg
              </span>
            </div>

            <div className="p-2 bg-background/80 rounded-xl border border-border/40">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Condition
              </span>
              <span className="font-bold text-foreground text-xs mt-1 block capitalize truncate">
                {condition.replace("_", " ")}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-9 px-4 font-semibold"
            >
              Close Preview
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
