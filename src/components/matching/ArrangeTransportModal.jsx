import React, { useState, useEffect } from "react";
import { 
  Truck, 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  Info,
  Layers,
  ChevronRight
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { arrangeTransport, updateTransportStatus } from "@/services/smartMatchService";

export const LOGISTICS_STATUS_FLOW = [
  { key: "ASSIGNED", label: "Transport Assigned", desc: "Vehicle & driver assigned by buyer" },
  { key: "PICKUP", label: "Pickup Scheduled", desc: "Driver scheduled for farm pickup" },
  { key: "COLLECTED", label: "Produce Collected", desc: "Loaded at farm location" },
  { key: "IN TRANSIT", label: "In Transit", desc: "Moving towards destination hub" },
  { key: "DELIVERED", label: "Delivered", desc: "Successfully delivered to buyer" }
];

export default function ArrangeTransportModal({
  open = false,
  onOpenChange = () => {},
  order = null,
  onTransportUpdated = () => {},
  onProceedToPayment = null
}) {
  if (!order) return null;

  const existingLogistics = order.logistics || order.procurement_summary?.logistics || order.summary?.logistics;
  const currentStatus = order.logistics_status || existingLogistics?.transportStatus || "ASSIGNED";

  const defaultDestination = order.demand?.destinationLocation?.city || order.buyer?.location?.city || order.delivery_location || "Madurai";

  const [transporterName, setTransporterName] = useState("");
  const [transporterPhone, setTransporterPhone] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("10:00 AM");
  const [destination, setDestination] = useState(defaultDestination);
  const [transportCost, setTransportCost] = useState("");
  const [gpsLatitude, setGpsLatitude] = useState("");
  const [gpsLongitude, setGpsLongitude] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (existingLogistics) {
      setTransporterName(existingLogistics.transporterName || "");
      setTransporterPhone(existingLogistics.transporterPhone || "");
      setDriverName(existingLogistics.driverName || "");
      setDriverPhone(existingLogistics.driverPhone || "");
      setVehicleNumber(existingLogistics.vehicleNumber || "");
      setPickupDate(existingLogistics.pickupDate || new Date().toISOString().split("T")[0]);
      setPickupTime(existingLogistics.pickupTime || "10:00 AM");
      setDestination(existingLogistics.destination || defaultDestination);
      setTransportCost(existingLogistics.transportCost !== undefined ? String(existingLogistics.transportCost) : "1200");
      setGpsLatitude(existingLogistics.gpsLatitude !== undefined && existingLogistics.gpsLatitude !== null ? String(existingLogistics.gpsLatitude) : "");
      setGpsLongitude(existingLogistics.gpsLongitude !== undefined && existingLogistics.gpsLongitude !== null ? String(existingLogistics.gpsLongitude) : "");
    } else {
      setTransporterName("");
      setTransporterPhone("");
      setDriverName("");
      setDriverPhone("");
      setVehicleNumber("");
      setPickupDate(new Date().toISOString().split("T")[0]);
      setPickupTime("10:00 AM");
      setDestination(defaultDestination);
      setTransportCost("1200");
      setGpsLatitude("");
      setGpsLongitude("");
    }
    setError(null);
  }, [existingLogistics, open, defaultDestination]);

  const handleSubmitDetails = async (e) => {
    e.preventDefault();
    setError(null);

    if (!transporterName.trim() || !driverName.trim() || !vehicleNumber.trim()) {
      setError("Please fill in Transporter Name, Driver Name, and Vehicle Number.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        transporterName: transporterName.trim(),
        transporterPhone: transporterPhone.trim() || null,
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim() || null,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        pickupDate: pickupDate || new Date().toISOString().split("T")[0],
        pickupTime: pickupTime || "10:00 AM",
        destination: destination.trim() || defaultDestination,
        transportCost: transportCost ? Number(transportCost) : 0,
        gpsLatitude: gpsLatitude.trim() ? Number(gpsLatitude) : null,
        gpsLongitude: gpsLongitude.trim() ? Number(gpsLongitude) : null,
        notes: statusNotes.trim() || undefined
      };

      const updated = await arrangeTransport(order.orderId || order.id, payload);
      onTransportUpdated(updated || order);
      onOpenChange(false);
      if (onProceedToPayment) {
        onProceedToPayment(updated || order);
      }
    } catch (err) {
      console.error("[ArrangeTransportModal] Error arranging transport:", err);
      setError(err.message || "Failed to save transport details.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceStatus = async (nextStatus) => {
    setError(null);
    setLoading(true);
    try {
      const gpsCoords = (gpsLatitude && gpsLongitude) ? { latitude: Number(gpsLatitude), longitude: Number(gpsLongitude) } : null;
      const updated = await updateTransportStatus(order.orderId || order.id, nextStatus, statusNotes.trim(), gpsCoords);
      onTransportUpdated(updated || order);
      setStatusNotes("");
      onOpenChange(false);
    } catch (err) {
      console.error("[ArrangeTransportModal] Status advance error:", err);
      setError(err.message || "Failed to update logistics status.");
    } finally {
      setLoading(false);
    }
  };

  const currentIndex = LOGISTICS_STATUS_FLOW.findIndex(s => s.key === currentStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {existingLogistics ? "Smart Logistics & Transport Plan" : "Step 1: Arrange Transport"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Order: <strong className="text-foreground">{order.orderId || order.id}</strong> • {order.demand?.crop || "Produce"}
              </p>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Informational Protocol Notice */}
        <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs space-y-1 text-muted-foreground">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <Info className="h-4 w-4 text-primary shrink-0" />
            <span>Buyer-Arranged Transport Protocol</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            As the buyer, you are responsible for arranging transport. Transport details will be automatically shared with the farmer. Transport cost is a separate logistics budget and <strong>never modifies the farmer's asking price</strong>.
          </p>
        </div>

        {/* Existing Status Stepper / Quick Advance for Buyer */}
        {existingLogistics && (
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground uppercase tracking-wider">Current Logistics Status</span>
              <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                {currentStatus}
              </Badge>
            </div>

            <div className="grid grid-cols-5 gap-1 pt-1">
              {LOGISTICS_STATUS_FLOW.map((step, idx) => {
                const isPassed = idx <= currentIndex;
                const isCurrent = idx === currentIndex;
                return (
                  <div key={step.key} className="flex flex-col items-center text-center">
                    <div className={`h-2.5 w-full rounded-full transition-all ${
                      isPassed ? "bg-emerald-500" : "bg-border/60"
                    }`} />
                    <span className={`text-[9px] mt-1.5 font-bold truncate max-w-full ${
                      isCurrent ? "text-primary" : (isPassed ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")
                    }`}>
                      {step.key}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Advance Status Button if not delivered */}
            {currentIndex < LOGISTICS_STATUS_FLOW.length - 1 && (
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/50">
                <div className="text-[11px] text-muted-foreground">
                  Next step: <strong>{LOGISTICS_STATUS_FLOW[currentIndex + 1].label}</strong>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAdvanceStatus(LOGISTICS_STATUS_FLOW[currentIndex + 1].key)}
                  disabled={loading}
                  className="rounded-xl text-xs font-bold h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <span>Advance to {LOGISTICS_STATUS_FLOW[currentIndex + 1].key}</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Transport Details Form */}
        <form onSubmit={handleSubmitDetails} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Transporter / Transport Company *
              </Label>
              <Input
                placeholder="e.g. Cauvery Fast Logistics Pvt Ltd"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                required
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Transporter Phone (Optional)
              </Label>
              <Input
                placeholder="e.g. 0452-2589000 or 9842100099"
                value={transporterPhone}
                onChange={(e) => setTransporterPhone(e.target.value)}
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Vehicle Number *
              </Label>
              <Input
                placeholder="e.g. TN-59-AC-4589"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                required
                className="rounded-xl h-9 text-xs uppercase font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Driver Name *
              </Label>
              <Input
                placeholder="e.g. R. Veerappan"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                required
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Driver Phone (Optional)
              </Label>
              <Input
                placeholder="e.g. 9876543210"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Pickup Date *
              </Label>
              <Input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                required
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Pickup Time *
              </Label>
              <Input
                placeholder="e.g. 08:30 AM"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                required
                className="rounded-xl h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Delivery Destination *
              </Label>
              <Input
                placeholder="e.g. Madurai Central Hub"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Transport Cost (₹)</span>
                <span className="text-[10px] text-muted-foreground font-normal">Buyer Budget</span>
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 1200"
                value={transportCost}
                onChange={(e) => setTransportCost(e.target.value)}
                className="rounded-xl h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* Optional Genuine GPS Coordinates for Dispatch Testing */}
          <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
            <Label className="text-[11px] font-bold text-foreground flex items-center justify-between">
              <span>Live GPS Broadcast (Optional / Transporter GPS)</span>
              <span className="text-[10px] text-muted-foreground font-normal">Genuine Coordinates Only</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                step="0.0001"
                placeholder="Latitude (e.g. 9.9252)"
                value={gpsLatitude}
                onChange={(e) => setGpsLatitude(e.target.value)}
                className="rounded-xl h-8 text-xs font-mono"
              />
              <Input
                type="number"
                step="0.0001"
                placeholder="Longitude (e.g. 78.1198)"
                value={gpsLongitude}
                onChange={(e) => setGpsLongitude(e.target.value)}
                className="rounded-xl h-8 text-xs font-mono"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Leave blank if GPS device is offline. Live GPS is displayed only when genuine coordinates exist.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Logistics Instructions / Notes (Optional)
            </Label>
            <Input
              placeholder="e.g. Crate packaging provided at farm gate, handle ripe tomatoes with care"
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              className="rounded-xl h-9 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-primary-foreground px-5 shadow-sm gap-1.5"
            >
              {loading ? "Saving Details..." : (existingLogistics ? "Save Transport Details" : "Save Transport & Proceed →")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
