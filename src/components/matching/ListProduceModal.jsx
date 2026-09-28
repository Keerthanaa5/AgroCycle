import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Sprout, 
  Sparkles, 
  CheckCircle2, 
  MapPin, 
  Loader2, 
  Package, 
  ShieldCheck, 
  DollarSign, 
  Plus,
  AlertCircle,
  Compass,
  Camera,
  Upload,
  X,
  Image as ImageIcon,
  Calendar
} from "lucide-react";
import { FRESH_PRODUCE_CATALOG } from "@/services/smartMatchService";
import { 
  MARKET_INTELLIGENCE_GRADES, 
  MARKET_INTELLIGENCE_GRADE_OPTIONS,
  normalizeMarketIntelligenceGrade 
} from "@/constants/marketIntelligence";
import { marketplaceService } from "@/services/marketplaceService";
import { getSavedLocation } from "@/services/locationService";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/i18n";

/**
 * Reusable List Fresh Produce Modal
 *
 * Exposes the farmer-side marketplace listing creation flow.
 * Submits directly to PostgreSQL via marketplaceService.createListing()
 * and immediately broadcasts Socket.IO listing:created for Market Intelligence matching.
 */
export default function ListProduceModal({
  open = false,
  onOpenChange = () => {},
  onSuccess = null
}) {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Produce list suggestions
  const allProduceSuggestions = [
    ...(FRESH_PRODUCE_CATALOG?.vegetables || []),
    ...(FRESH_PRODUCE_CATALOG?.fruits || [])
  ];

  // Form State
  const [cropType, setCropType] = useState("Tomato");
  const [quantityKg, setQuantityKg] = useState("");
  const [condition, setCondition] = useState(MARKET_INTELLIGENCE_GRADES.GRADE_A_PREMIUM);
  const [askingPrice, setAskingPrice] = useState("");
  const [availableDate, setAvailableDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [locationText, setLocationText] = useState("");
  const [geoCoordinates, setGeoCoordinates] = useState({ latitude: null, longitude: null });
  const [isRequestingGps, setIsRequestingGps] = useState(false);
  const [locationNotice, setLocationNotice] = useState("");
  const [producePhotos, setProducePhotos] = useState([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Handler to request genuine browser geolocation permission without inventing fake coordinates
  const handleRequestLocation = async () => {
    setIsRequestingGps(true);
    setLocationNotice("");

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoCoordinates({ latitude: null, longitude: null });
      setLocationNotice("Geolocation is not supported by your browser. Location access helps buyers estimate sourcing distance.");
      setIsRequestingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lon = Number(pos.coords.longitude);
        setGeoCoordinates({ latitude: lat, longitude: lon });
        setLocationNotice("");
        setIsRequestingGps(false);
      },
      (err) => {
        setGeoCoordinates({ latitude: null, longitude: null });
        if (err.code === 1) {
          setLocationNotice("Location permission denied. Location access helps buyers estimate sourcing distance.");
        } else {
          setLocationNotice("Unable to retrieve GPS coordinates. Location access helps buyers estimate sourcing distance.");
        }
        setIsRequestingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Client-side lightweight image processing (max 1024px, JPEG 0.8)
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsProcessingPhotos(true);
    try {
      const availableSlots = Math.max(0, 3 - producePhotos.length);
      const selectedFiles = files.slice(0, availableSlots);
      const processed = await Promise.all(selectedFiles.map(compressImage));
      const validPhotos = processed.filter(Boolean);
      setProducePhotos((prev) => [...prev, ...validPhotos].slice(0, 3));
    } catch (err) {
      console.warn("Failed to process produce photo:", err);
    } finally {
      setIsProcessingPhotos(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemovePhoto = (indexToRemove) => {
    setProducePhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Prefill location on open from saved farmer profile / locationService without inventing GPS
  useEffect(() => {
    if (open) {
      setErrorMsg("");
      setSuccessMsg("");
      setLocationNotice("");
      setProducePhotos([]);
      setQuantityKg("");
      setAskingPrice("");
      setAvailableDate(new Date().toISOString().split("T")[0]);

      const currentUserId = user?.userId || user?.id || "default_user";
      getSavedLocation(currentUserId).then((saved) => {
        if (saved) {
          const locParts = [saved.address, saved.city, saved.district, saved.state].filter(Boolean);
          const fullLoc = locParts.length > 0 ? (saved.city ? `${saved.city}, ${saved.state || "Tamil Nadu"}` : saved.address) : "";
          if (fullLoc) setLocationText(fullLoc);

          if (saved.latitude && saved.longitude) {
            setGeoCoordinates({
              latitude: Number(saved.latitude),
              longitude: Number(saved.longitude)
            });
          } else {
            setGeoCoordinates({ latitude: null, longitude: null });
          }
        } else if (user?.location || user?.district) {
          const uLoc = user.location || `${user.district || "Madurai"}, ${user.state || "Tamil Nadu"}`;
          setLocationText(uLoc);
          setGeoCoordinates({ latitude: null, longitude: null });
        }
      }).catch(() => {
        setGeoCoordinates({ latitude: null, longitude: null });
      });
    }
  }, [open, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const trimmedCrop = cropType.trim();
    if (!trimmedCrop) {
      setErrorMsg("Please specify a produce / crop name.");
      return;
    }

    const parsedQty = parseFloat(quantityKg);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMsg("Please enter a valid positive quantity in kg (e.g. 5, 21, 250, 1000). Quantity must be greater than 0.");
      return;
    }

    const parsedPrice = parseFloat(askingPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setErrorMsg("Please enter a valid asking price per kg.");
      return;
    }

    const trimmedLoc = locationText.trim();
    if (!trimmedLoc) {
      setErrorMsg("Please provide your farm location or district.");
      return;
    }

    setSubmitting(true);

    try {
      const formattedAvailDate = availableDate || new Date().toISOString().split("T")[0];
      const payload = {
        id: `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        creator_id: user?.userId || user?.id || "usr_farmer_ramesh_01",
        creator_role: "farmer",
        farmer_name: user?.name || user?.full_name || "Agro Farmer",
        contact_phone: user?.phone || null,
        crop_type: trimmedCrop,
        quantity_kg: parsedQty,
        quality_grade: condition,
        qualityGrade: condition,
        condition: condition,
        asking_price: parsedPrice,
        available_date: formattedAvailDate,
        availableDate: formattedAvailDate,
        harvestDate: formattedAvailDate,
        location: trimmedLoc,
        latitude: geoCoordinates.latitude ?? null,
        longitude: geoCoordinates.longitude ?? null,
        images: producePhotos,
        image_url: producePhotos.length > 0 ? JSON.stringify(producePhotos) : null,
        status: "listed",
        title: `${trimmedCrop} Fresh Produce`
      };

      const result = await marketplaceService.createListing(payload, user);

      if (result.success) {
        setSuccessMsg(`✅ Successfully listed ${parsedQty} kg of ${trimmedCrop} at ₹${parsedPrice}/kg!`);
        setTimeout(() => {
          setSubmitting(false);
          onOpenChange(false);
          if (onSuccess) {
            onSuccess(result.data);
          }
        }, 1200);
      } else {
        setSubmitting(false);
        setErrorMsg(result.error || "Unable to publish listing. Please try again.");
      }
    } catch (err) {
      setSubmitting(false);
      setErrorMsg(err.message || "An unexpected error occurred while listing produce.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                List Fresh Produce
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground">
                What do you have? Declare your fresh produce supply for AgroCycle Smart Matching
              </p>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* 1. Produce / Crop Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Produce / Crop Name *</span>
              <span className="text-[10px] lowercase text-primary font-normal">e.g. Tomato, Onion, Banana</span>
            </label>
            <div className="relative">
              <Input
                list="fresh-produce-catalog-list"
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                placeholder="e.g. Tomato, Onion, Potato, Banana"
                required
                className="h-10 text-xs font-semibold rounded-xl"
              />
              <datalist id="fresh-produce-catalog-list">
                {allProduceSuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
          </div>

          {/* 2. Available Quantity (kg) & Asking Price (₹/kg) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3 text-primary" />
                <span>Quantity (kg) *</span>
              </label>
              <Input
                type="number"
                min="0.01"
                step="any"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                placeholder="e.g. 250"
                required
                className="h-10 text-xs font-bold font-mono rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-primary" />
                <span>Price (₹ / kg) *</span>
              </label>
              <Input
                type="number"
                min="0.01"
                step="any"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="e.g. 28"
                required
                className="h-10 text-xs font-bold font-mono rounded-xl"
              />
            </div>
          </div>

          {/* 3. Quality / Condition & Available Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>Quality & Condition *</span>
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full h-10 text-xs font-semibold rounded-xl bg-background border border-input px-3"
              >
                {MARKET_INTELLIGENCE_GRADE_OPTIONS.map((gradeOpt) => (
                  <option key={gradeOpt} value={gradeOpt}>
                    {gradeOpt}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Available Date *</span>
              </label>
              <Input
                type="date"
                value={availableDate}
                onChange={(e) => setAvailableDate(e.target.value)}
                required
                className="h-10 text-xs font-semibold rounded-xl"
              />
            </div>
          </div>

          {/* 4. Farm Location / District */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>Farm Location / District *</span>
            </label>
            <Input
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="e.g. Melur Road, Madurai"
              required
              className="h-10 text-xs font-semibold rounded-xl"
            />
          </div>

          {/* 5. GPS Permission & Location Status */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 text-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <Compass className="h-3.5 w-3.5 text-primary" />
                <span>Location:</span>
              </span>
              {geoCoordinates.latitude !== null && geoCoordinates.longitude !== null ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  ✓ GPS location available
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 text-[10px] font-bold gap-1">
                  <AlertCircle className="h-3 w-3" />
                  ⚠ Location permission not granted
                </Badge>
              )}
            </div>

            {geoCoordinates.latitude !== null && geoCoordinates.longitude !== null ? (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-background/80 px-3 py-1.5 rounded-xl border border-border/60">
                <span className="font-mono text-foreground font-medium">
                  {geoCoordinates.latitude.toFixed(4)}° N, {geoCoordinates.longitude.toFixed(4)}° E
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRequestLocation}
                  disabled={isRequestingGps}
                  className="h-6 text-[10px] text-primary px-2 hover:text-primary/80"
                >
                  {isRequestingGps ? <Loader2 className="h-3 w-3 animate-spin" /> : "Re-check GPS"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2 pt-0.5">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Location access helps buyers estimate sourcing distance.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRequestLocation}
                  disabled={isRequestingGps}
                  className="w-full h-8 text-xs font-semibold gap-1.5 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5"
                >
                  {isRequestingGps ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Requesting browser location...</span>
                    </>
                  ) : (
                    <>
                      <Compass className="h-3.5 w-3.5" />
                      <span>Allow Location Access</span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {locationNotice && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium leading-tight">
                {locationNotice}
              </p>
            )}
          </div>

          {/* 6. Produce Photos (1–3 Photos) */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-muted/30 border border-border/70">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Camera className="h-3.5 w-3.5 text-primary" />
                <span>Produce Photos (1–3 Photos)</span>
              </label>
              <Badge variant="outline" className={`text-[10px] font-bold ${producePhotos.length === 3 ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : "bg-background"}`}>
                {producePhotos.length}/3 photos
              </Badge>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Attach photographs of your actual harvest so buyers can inspect produce quality before confirming orders.
            </p>

            {/* Photo thumbnails + upload button */}
            <div className="flex items-center gap-2.5 flex-wrap pt-1">
              {producePhotos.map((photo, idx) => (
                <div key={idx} className="relative h-16 w-16 rounded-xl overflow-hidden border-2 border-primary/40 bg-background group shrink-0">
                  <img src={photo} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 bg-black/70 hover:bg-rose-600 text-white p-0.5 rounded-full opacity-90 transition-all cursor-pointer"
                    title="Remove Photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-mono text-center py-0.5">
                    Photo {idx + 1}
                  </span>
                </div>
              ))}

              {producePhotos.length < 3 && (
                <label className={`h-16 px-3.5 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isProcessingPhotos
                    ? "border-muted bg-muted/20 opacity-50 cursor-not-allowed"
                    : "border-primary/40 hover:border-primary bg-background hover:bg-primary/5 text-primary"
                }`}>
                  {isProcessingPhotos ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-[10px] font-semibold text-muted-foreground">Processing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span className="text-[10px] font-bold">+ Add Photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isProcessingPhotos || producePhotos.length >= 3}
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Direct Buyer Fresh Produce Pooling
            </p>
            <p>
              Once listed, this harvest lot immediately enters the Market Intelligence matching engine so commercial food buyers and retail chains can pool your produce into confirmed orders.
            </p>
          </div>

          {/* Submit Action */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="flex-1 rounded-xl text-xs font-semibold h-10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl text-xs font-bold h-10 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Publish Listing</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
