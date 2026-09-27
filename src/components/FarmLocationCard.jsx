import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/i18n";
import {
  getSavedLocation,
  captureAndSaveCurrentLocation,
  clearLocation,
  formatCoordinate,
  LOCATION_STATUS
} from "@/services/locationService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Loader2,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Reusable Farm Location / GPS Card Component
 *
 * Provides a clean, permission-based interface for capturing and managing
 * device GPS coordinates offline without continuous tracking or external map APIs.
 */
export default function FarmLocationCard({
  userId = null,
  farmId = "default",
  onLocationChange = null,
  className = ""
}) {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const effectiveUserId = userId || user?.userId || user?.id || "default_user";

  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState(LOCATION_STATUS.NOT_SET);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successNotice, setSuccessNotice] = useState(false);

  // Load saved location on component mount / user change
  const loadLocation = useCallback(async () => {
    try {
      const saved = await getSavedLocation(effectiveUserId, farmId);
      if (saved && typeof saved.latitude === "number" && typeof saved.longitude === "number") {
        setLocation(saved);
        setStatus(LOCATION_STATUS.AVAILABLE);
        if (onLocationChange) onLocationChange(saved);
      } else {
        setLocation(null);
        setStatus(LOCATION_STATUS.NOT_SET);
      }
    } catch (err) {
      console.warn("[FarmLocationCard] Failed to load saved location:", err);
    }
  }, [effectiveUserId, farmId, onLocationChange]);

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  // Request GPS position from device
  const handleCaptureLocation = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setStatus(LOCATION_STATUS.REQUESTING);

    try {
      const result = await captureAndSaveCurrentLocation(effectiveUserId, farmId, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      });

      if (result.success && result.location) {
        setLocation(result.location);
        setStatus(LOCATION_STATUS.AVAILABLE);
        setSuccessNotice(true);
        setTimeout(() => setSuccessNotice(false), 4000);
        if (onLocationChange) onLocationChange(result.location);
      } else {
        setStatus(result.status || LOCATION_STATUS.ERROR);
        setErrorMessage(
          result.error ||
            (language === "ta"
              ? "இருப்பிடத்தை அணுக முடியவில்லை."
              : language === "hi"
              ? "स्थान प्राप्त करने में असमर्थ।"
              : "Unable to retrieve device location.")
        );
      }
    } catch (err) {
      setStatus(LOCATION_STATUS.ERROR);
      setErrorMessage(err.message || "An unexpected error occurred while capturing GPS.");
    } finally {
      setIsLoading(false);
    }
  };

  // Clear saved location
  const handleClearLocation = async () => {
    try {
      await clearLocation(effectiveUserId, farmId);
      setLocation(null);
      setStatus(LOCATION_STATUS.NOT_SET);
      setErrorMessage(null);
      if (onLocationChange) onLocationChange(null);
    } catch (err) {
      console.error("[FarmLocationCard] Failed to clear location:", err);
    }
  };

  return (
    <div className={`bg-card rounded-2xl border border-border/80 p-5 space-y-4 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t("location.title") || "Farm Location (GPS)"}
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {language === "ta"
                ? "உங்கள் பண்ணைக்கான துல்லியமான GPS ஒருங்கிணைப்புகளைப் பதிவு செய்யவும்."
                : language === "hi"
                ? "अपने खेत के लिए सटीक जीपीएस निर्देशांक दर्ज करें।"
                : "Capture on-device GPS coordinates for offline profile and resource matching."}
            </p>
          </div>
        </div>

        {location && (
          <Badge
            variant="outline"
            className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 px-2.5 py-0.5 rounded-full font-bold"
          >
            <CheckCircle2 className="h-3 w-3 mr-1 inline" />
            {t("location.captured") || "Location Captured"}
          </Badge>
        )}
      </div>

      {/* Captured Location Display */}
      {location ? (
        <div className="space-y-3">
          {/* City / District / State / Country Card */}
          <div className="bg-muted/40 p-4 rounded-xl border border-border/70 space-y-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>{t("location.farmLocation") || "Farm Location"}</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                {location.city || location.district
                  ? `${location.city || location.district}${location.state ? `, ${location.state}` : ""}`
                  : location.state
                  ? location.state
                  : (t("location.cityUnavailable") || "City unavailable")}
              </h3>
              {location.country && (
                <p className="text-xs text-muted-foreground font-medium">
                  {location.country}
                </p>
              )}
            </div>

            {/* Coordinates & Accuracy Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-border/60 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  {t("location.latitude") || "Latitude"}
                </span>
                <strong className="text-foreground text-xs font-mono mt-0.5 block">
                  {formatCoordinate(location.latitude, 4)}
                </strong>
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  {t("location.longitude") || "Longitude"}
                </span>
                <strong className="text-foreground text-xs font-mono mt-0.5 block">
                  {formatCoordinate(location.longitude, 4)}
                </strong>
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  {t("location.accuracy") || "Accuracy"}
                </span>
                <strong className="text-foreground text-xs mt-0.5 block">
                  ±{Math.round(location.accuracy || 0)} m
                </strong>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>
                {t("location.offlinePrivacyNotice") ||
                  "Stored securely on-device in IndexedDB • Available 100% offline."}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCaptureLocation}
                disabled={isLoading}
                className="h-8 text-xs gap-1.5 rounded-xl border-border/80"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span>{t("location.update") || "Update Location"}</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearLocation}
                disabled={isLoading}
                className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                <span>{t("location.clear") || "Clear"}</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Not Set / Initial Request State */
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-muted/20 rounded-xl border border-dashed border-border/80">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">
                {language === "ta"
                  ? "ஜிபிஎஸ் ஒருங்கிணைப்புகள் இன்னும் பதிவு செய்யப்படவில்லை"
                  : language === "hi"
                  ? "जीपीएस निर्देशांक अभी तक दर्ज नहीं किए गए हैं"
                  : "No GPS coordinates saved for this profile"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {language === "ta"
                  ? "உலாவியின் அனுமதியுடன் தற்போதைய இருப்பிடத்தைப் பெற கீழே உள்ள பொத்தானைக் கிளிக் செய்யவும்."
                  : language === "hi"
                  ? "ब्राउज़र अनुमति के साथ वर्तमान स्थान प्राप्त करने के लिए नीचे क्लिक करें।"
                  : "Click below to request a one-time GPS fix via your browser/device."}
              </p>
            </div>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleCaptureLocation}
              disabled={isLoading}
              className="gap-2 rounded-xl text-xs font-semibold shadow-xs shrink-0 w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{t("location.capturing") || "Capturing GPS Location..."}</span>
                </>
              ) : (
                <>
                  <Navigation className="h-3.5 w-3.5" />
                  <span>{t("location.useCurrentLocation") || "Use Current Location"}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Error / Denial Notice */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{errorMessage}</p>
              {status === LOCATION_STATUS.DENIED && (
                <p className="text-[11px] text-muted-foreground">
                  {t("location.permissionDenied") ||
                    "Location permission was denied. You can enable it later or enter your location manually when a location-based feature requires it."}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Notification */}
      <AnimatePresence>
        {successNotice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-semibold"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              {language === "ta"
                ? "இருப்பிடம் வெற்றிகரமாக சேமிக்கப்பட்டது!"
                : language === "hi"
                ? "स्थान सफलतापूर्वक सहेजा गया!"
                : "Farm GPS coordinates captured and saved successfully!"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
